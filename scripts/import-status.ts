import process from 'node:process'
import { Pool } from 'pg'
import { loadLocalEnv } from './load-env'

loadLocalEnv()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required to inspect import status.')
}

const pool = new Pool({ connectionString })

try {
  const latestBatch = await pool.query<{
    id: string
    source_dir: string
    created_at: Date
  }>('select id, source_dir, created_at from bubble_import_batches order by created_at desc limit 1')

  if (!latestBatch.rows[0]) {
    console.log('No Bubble import batches found.')
    process.exit(0)
  }

  const batch = latestBatch.rows[0]
  console.log(`Latest batch: ${batch.id}`)
  console.log(`Source: ${batch.source_dir}`)
  console.log(`Created: ${batch.created_at.toISOString()}`)

  const rowCounts = await pool.query<{
    entity_name: string
    source_variant: string
    source_file: string
    rows: number
  }>(
    `select entity_name, source_variant, source_file, count(*)::int as rows
     from bubble_import_rows
     where batch_id = $1
     group by entity_name, source_variant, source_file
     order by entity_name, source_variant, source_file`,
    [batch.id],
  )

  console.log('\nRows by source')
  console.table(rowCounts.rows)

  const totals = await pool.query<{
    raw_rows: number
    relationship_tokens: number
  }>(
    `select
      (select count(*)::int from bubble_import_rows where batch_id = $1) as raw_rows,
      (select count(*)::int from bubble_import_relationships where batch_id = $1) as relationship_tokens`,
    [batch.id],
  )

  console.log('\nTotals')
  console.table(totals.rows)
} finally {
  await pool.end()
}
