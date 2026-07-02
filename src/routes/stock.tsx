import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { ArrowRight, ArrowRightLeft, ClipboardList, PackageCheck, PencilLine, PlusCircle } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { getStockOverview, listStockMovements } from '../lib/stock.functions'
import { formatDateTime, formatNumber, titleCase } from '../lib/utils'

export const Route = createFileRoute('/stock')({
  loader: async () => {
    const [overview, movements] = await Promise.all([
      getStockOverview(),
      listStockMovements(),
    ])

    return { overview, movements: movements.slice(0, 8) }
  },
  component: StockPage,
})

function StockPage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })
  const { overview, movements } = Route.useLoaderData()

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Stock</h1>
          <p className="page-description">Balances are derived from auditable stock movements, not direct quantity edits.</p>
        </div>
        <Link to="/stock/transfer" className="polaris-button polaris-button-primary">
          <ArrowRightLeft className="h-4 w-4" /> Transfer stock
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="metric-card">
          <Badge tone="success">Available</Badge>
          <p className="metric-value mt-4">{formatNumber(overview.available)}</p>
          <p className="section-muted mt-1">Units across sellable stock</p>
        </article>
        <article className="metric-card">
          <Badge tone="warning">Committed</Badge>
          <p className="metric-value mt-4">{formatNumber(overview.committed)}</p>
          <p className="section-muted mt-1">Reserved by open orders</p>
        </article>
        <article className="metric-card">
          <Badge tone="danger">Reorder</Badge>
          <p className="metric-value mt-4">{formatNumber(overview.lowStock)}</p>
          <p className="section-muted mt-1">SKUs under reorder level</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Link to="/stock/transfer" className="section-card block">
          <ArrowRightLeft className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Transfer stock</h2>
          <p className="section-muted mt-1">Move stock between assigned sales users through paired ledger movements.</p>
          <span className="app-link mt-4 inline-flex items-center gap-1 text-sm">Open <ArrowRight className="h-4 w-4" /></span>
        </Link>
        <Link to="/stock/receive" className="section-card block">
          <PlusCircle className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Receive stock</h2>
          <p className="section-muted mt-1">Record inbound warehouse quantities with lot and location context.</p>
          <span className="app-link mt-4 inline-flex items-center gap-1 text-sm">Open <ArrowRight className="h-4 w-4" /></span>
        </Link>
        <Link to="/stock/adjust" className="section-card block">
          <PencilLine className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Adjust stock</h2>
          <p className="section-muted mt-1">Create correction movements with remarks and audit trail.</p>
          <span className="app-link mt-4 inline-flex items-center gap-1 text-sm">Open <ArrowRight className="h-4 w-4" /></span>
        </Link>
        <Link to="/stock/movements" className="section-card block">
          <PackageCheck className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Stock movements</h2>
          <p className="section-muted mt-1">Review the append-only ledger behind all balances.</p>
          <span className="app-link mt-4 inline-flex items-center gap-1 text-sm">Open <ArrowRight className="h-4 w-4" /></span>
        </Link>
      </section>

      <section className="section-card">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading">Recent stock movements</h2>
        </div>
        <div className="space-y-3">
          {movements.length ? movements.map((movement) => (
            <div key={movement.id} className="list-row grid gap-2 p-4 text-sm sm:grid-cols-[180px_1fr_120px_180px]">
              <span className="font-semibold text-[#202223]">{titleCase(movement.movement_type.replace(/_/g, ' '))}</span>
              <span className="text-[#616161]">{movement.product_name ?? movement.sku_code ?? 'Unknown product'}</span>
              <span className={movement.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'}>{movement.quantity > 0 ? '+' : ''}{formatNumber(movement.quantity)}</span>
              <span className="text-[#616161]">{formatDateTime(movement.created_at)}</span>
            </div>
          )) : <p className="section-muted">No stock movements have been recorded yet.</p>}
        </div>
      </section>
    </div>
  )
}
