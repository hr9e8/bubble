import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'
import { countValue } from './server/db-helpers'

const batchIdInput = z.object({ batchId: z.string().uuid() })

const getServerDeps = createServerOnlyFn(async () => {
  const [db, authContext] = await Promise.all([
    import('./db/client'),
    import('./server/auth-context'),
  ])

  return { ...db, ...authContext }
})

export const listMigrationBatches = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, requireCurrentUser } = await getServerDeps()
  await requireCurrentUser({ permissions: ['migration:run'] })

  return getDatabase()
    .selectFrom('bubble_import_batches')
    .select(['id', 'source_dir', 'created_at'])
    .orderBy('created_at', 'desc')
    .limit(25)
    .execute()
})

export const getMigrationBatchStatus = createServerFn({ method: 'GET' })
  .validator(batchIdInput)
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser } = await getServerDeps()
    await requireCurrentUser({ permissions: ['migration:run'] })

    const batch = await getDatabase()
      .selectFrom('bubble_import_batches')
      .select(['id', 'source_dir', 'profile', 'created_at'])
      .where('id', '=', data.batchId)
      .executeTakeFirst()

    if (!batch) return null

    const rowCounts = await getDatabase()
      .selectFrom('bubble_import_rows')
      .select(['entity_name'])
      .select((eb) => eb.fn.countAll().as('row_count'))
      .where('batch_id', '=', data.batchId)
      .groupBy('entity_name')
      .orderBy('entity_name')
      .execute()

    const unresolvedRelationships = await getDatabase()
      .selectFrom('bubble_import_relationships')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('batch_id', '=', data.batchId)
      .where('resolved_id', 'is', null)
      .executeTakeFirst()

    return {
      batch,
      rowCounts: rowCounts.map((row) => ({
        entity_name: row.entity_name,
        row_count: countValue(row.row_count),
      })),
      unresolvedRelationships: countValue(unresolvedRelationships?.count),
    }
  })

export const listReconciliationReports = createServerFn({ method: 'GET' })
  .validator(batchIdInput.optional())
  .handler(async ({ data }) => {
    const { getDatabase, requireCurrentUser } = await getServerDeps()
    await requireCurrentUser({ permissions: ['migration:run'] })

    let query = getDatabase()
      .selectFrom('migration_reconciliation_reports')
      .select(['id', 'batch_id', 'report_type', 'status', 'summary', 'created_at'])
      .orderBy('created_at', 'desc')
      .limit(100)

    if (data?.batchId) {
      query = query.where('batch_id', '=', data.batchId)
    }

    const reports = await query.execute()
    return reports.map((report) => ({
      ...report,
      summary: report.summary,
    }))
  })
