import { createFileRoute } from '@tanstack/react-router'
import { ModulePage } from '../components/module-page'

export const Route = createFileRoute('/admin/migration/reconciliation')({ component: MigrationReconciliationPage })

function MigrationReconciliationPage() {
  return (
    <ModulePage
      title="Reconciliation"
      description="Review reports written by the transform script for source-to-target counts, order totals, orphan checks, stock balances, payment statuses, and skipped rows."
      badge="Cutover"
      sections={[
        { title: 'Entity counts', detail: 'Compare canonical or modified Bubble source rows to transformed users, products, customers, orders, order items, stock lots, and stock movements.' },
        { title: 'Financial checks', detail: 'Flag transformed order totals that differ from Bubble totals by more than one cent.' },
        { title: 'Integrity checks', detail: 'Report missing order links, missing customers, missing products, unresolved relationship tokens, skipped rows, stock mismatches, and payment status differences.' },
      ]}
    />
  )
}
