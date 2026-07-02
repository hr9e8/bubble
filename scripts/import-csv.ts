import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { Pool } from 'pg'
import { parseCsv, profileCsv } from '../src/lib/migration/csv'
import { bubbleSources, splitBubbleList } from '../src/lib/migration/sources'
import { loadLocalEnv } from './load-env'

loadLocalEnv()
const dryRun = process.argv.includes('--dry-run')
const dirArg = process.argv.find((arg) => arg.startsWith('--dir='))
const sourceDir = dirArg?.slice('--dir='.length) || 'data-example'

async function readSource(file: string) {
  const sourcePath = file.includes('/') ? file : join(sourceDir, file)
  const text = await readFile(sourcePath, 'utf8')
  return {
    text,
    rows: parseCsv(text),
    profile: profileCsv(file, text),
  }
}

const profiles = []
const rowSets = []

for (const source of bubbleSources) {
  const canonical = await readSource(source.canonicalFile)
  profiles.push(canonical.profile)
  rowSets.push({
    source,
    sourceFile: source.canonicalFile,
    sourceVariant: 'canonical',
    rows: canonical.rows,
  })

  for (const variantFile of source.variantFiles ?? []) {
    const variant = await readSource(variantFile)
    profiles.push(variant.profile)
    rowSets.push({
      source,
      sourceFile: variantFile,
      sourceVariant: 'variant',
      rows: variant.rows,
    })
  }
}

if (dryRun) {
  for (const profile of profiles) {
    console.log(`${profile.file}: ${profile.rowCount} rows, ${profile.columnCount} columns`)
  }
  process.exit(0)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required unless running with --dry-run.')
}

const pool = new Pool({ connectionString })
const rawRowBatchSize = 500
const relationshipBatchSize = 1000

type SourceRowSet = (typeof rowSets)[number]

function placeholders(start: number, rows: number, columns: number) {
  return Array.from({ length: rows }, (_, rowIndex) => {
    const offset = start + rowIndex * columns
    return `(${Array.from({ length: columns }, (_, columnIndex) => `$${offset + columnIndex}`).join(', ')})`
  }).join(', ')
}

async function insertRawRows(batchId: string, rowSet: SourceRowSet) {
  let inserted = 0

  for (let start = 0; start < rowSet.rows.length; start += rawRowBatchSize) {
    const chunk = rowSet.rows.slice(start, start + rawRowBatchSize)
    const values: Array<unknown> = []

    for (const [chunkIndex, row] of chunk.entries()) {
      const rowIndex = start + chunkIndex + 1
      const legacyBubbleId = rowSet.source.idColumn ? row[rowSet.source.idColumn] || null : null
      const legacySlug = rowSet.source.slugColumn ? row[rowSet.source.slugColumn] || null : null

      values.push(
        batchId,
        rowSet.source.entityName,
        rowSet.sourceFile,
        rowSet.sourceVariant,
        rowIndex,
        legacyBubbleId,
        legacySlug,
        JSON.stringify(row),
      )
    }

    await pool.query(
      `insert into bubble_import_rows
        (batch_id, entity_name, source_file, source_variant, row_index, legacy_bubble_id, legacy_slug, raw_data)
       values ${placeholders(1, chunk.length, 8)}`,
      values,
    )

    inserted += chunk.length
    console.log(`  rows ${inserted}/${rowSet.rows.length}`)
  }
}

async function insertRelationships(batchId: string, rowSet: SourceRowSet) {
  let pending: Array<unknown> = []
  let inserted = 0

  async function flush() {
    if (pending.length === 0) return

    const relationshipCount = pending.length / 7
    await pool.query(
      `insert into bubble_import_relationships
        (batch_id, entity_name, source_file, source_row_index, source_column, target_token, target_hint)
       values ${placeholders(1, relationshipCount, 7)}`,
      pending,
    )
    inserted += relationshipCount
    pending = []
    console.log(`  relationships ${inserted}`)
  }

  for (const [index, row] of rowSet.rows.entries()) {
    for (const [column, targetHint] of Object.entries(rowSet.source.relationshipColumns ?? {})) {
      for (const token of splitBubbleList(row[column])) {
        pending.push(batchId, rowSet.source.entityName, rowSet.sourceFile, index + 1, column, token, targetHint)

        if (pending.length / 7 >= relationshipBatchSize) {
          await flush()
        }
      }
    }
  }

  await flush()
  if (inserted === 0) {
    console.log('  relationships 0')
  }
}

try {
  await pool.query('begin')
  console.log(`Creating import batch for ${sourceDir}`)
  const batch = await pool.query(
    'insert into bubble_import_batches (source_dir, profile) values ($1, $2) returning id',
    [sourceDir, JSON.stringify(profiles)],
  )
  const batchId = batch.rows[0].id as string
  console.log(`Batch ${batchId}`)

  for (const rowSet of rowSets) {
    console.log(`${rowSet.sourceFile} (${rowSet.sourceVariant})`)
    await insertRawRows(batchId, rowSet)
    await insertRelationships(batchId, rowSet)
  }

  await pool.query('commit')
  console.log(`Imported Bubble CSV batch ${batchId}`)
} catch (error) {
  await pool.query('rollback')
  throw error
} finally {
  await pool.end()
}
