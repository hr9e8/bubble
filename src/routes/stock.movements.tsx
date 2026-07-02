import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRightLeft, PackageCheck, PackagePlus, PencilLine } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { listStockMovements } from '../lib/stock.functions'
import { formatDateTime, formatNumber, titleCase } from '../lib/utils'

export const Route = createFileRoute('/stock/movements')({
  loader: () => listStockMovements(),
  component: StockMovementsPage,
})

function StockMovementsPage() {
  const movements = Route.useLoaderData()
  const inboundCount = movements.filter((movement) => movement.quantity > 0).length
  const outboundCount = movements.filter((movement) => movement.quantity < 0).length
  const netQuantity = movements.reduce((sum, movement) => sum + movement.quantity, 0)

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Stock movements</h1>
          <p className="page-description">Append-only movement ledger for receives, adjustments, assignments, transfers, reservations, releases, and fulfillment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/stock/receive" className="polaris-button polaris-button-secondary">
            <PackagePlus className="h-4 w-4" /> Receive
          </Link>
          <Link to="/stock/adjust" className="polaris-button polaris-button-secondary">
            <PencilLine className="h-4 w-4" /> Adjust
          </Link>
          <Link to="/stock/transfer" className="polaris-button polaris-button-primary">
            <ArrowRightLeft className="h-4 w-4" /> Transfer
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="metric-card">
          <Badge tone="success">Inbound rows</Badge>
          <p className="metric-value mt-4">{formatNumber(inboundCount)}</p>
          <p className="section-muted mt-1">Positive ledger entries</p>
        </article>
        <article className="metric-card">
          <Badge tone="danger">Outbound rows</Badge>
          <p className="metric-value mt-4">{formatNumber(outboundCount)}</p>
          <p className="section-muted mt-1">Negative ledger entries</p>
        </article>
        <article className="metric-card">
          <PackageCheck className="h-5 w-5 text-[#008060]" />
          <p className="metric-value mt-4">{netQuantity > 0 ? '+' : ''}{formatNumber(netQuantity)}</p>
          <p className="section-muted mt-1">Net quantity in latest 100 rows</p>
        </article>
      </section>

      <section className="table-card">
        <div className="border-b border-[#dedede] p-4">
          <h2 className="section-heading">Latest ledger rows</h2>
        </div>
        <div className="divide-y divide-[#ebebeb]">
          {movements.length ? movements.map((movement) => (
            <div key={movement.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[190px_1fr_130px_180px_220px]">
              <span className="font-semibold text-[#202223]">{titleCase(movement.movement_type.replace(/_/g, ' '))}</span>
              <span className="text-[#616161]">{movement.product_name ?? 'Unknown product'}{movement.sku_code ? ` · ${movement.sku_code}` : ''}</span>
              <span className={movement.quantity > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                {movement.quantity > 0 ? '+' : ''}{formatNumber(movement.quantity)}
              </span>
              <span className="text-[#616161]">{movement.user_related_id ?? 'No owner'}</span>
              <span className="text-[#616161]">{formatDateTime(movement.created_at)}</span>
            </div>
          )) : (
            <div className="p-4">
              <p className="section-muted">No stock movements have been recorded yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
