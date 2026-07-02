import { createFileRoute } from '@tanstack/react-router'
import { ModulePage } from '../components/module-page'

export const Route = createFileRoute('/admin/migration/batches/$batchId')({ component: MigrationBatchPage })

function MigrationBatchPage() {
  const { batchId } = Route.useParams()

  return (
    <ModulePage
      title={`Migration batch ${batchId}`}
      description="Inspect staged rows, source variants, relationship discovery, unresolved Bubble references, and profile metadata."
      badge="Migration"
      sections={[
        { title: 'Raw rows', detail: 'Canonical and variant CSV rows are preserved as raw JSON for traceability.' },
        { title: 'Relationships', detail: 'Bubble list tokens are staged before resolution into normalized foreign keys.' },
        { title: 'Locking', detail: 'Final cutover can lock a batch after import, transform, reconcile, and admin creation.' },
      ]}
    />
  )
}
