import { Link, Outlet, createFileRoute, useRouter, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ClipboardList, PackageCheck, ScanBarcode, Truck } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { listWarehouseQueue, markOrderPacked, markOrderPicked, markOrderShipped } from '../lib/warehouse.functions'

export const Route = createFileRoute('/warehouse')({
  loader: () => listWarehouseQueue(),
  component: WarehousePage,
})

function WarehousePage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })
  const router = useRouter()
  const queue = Route.useLoaderData()
  const pick = useServerFn(markOrderPicked)
  const pack = useServerFn(markOrderPacked)
  const ship = useServerFn(markOrderShipped)
  const readyCount = queue.filter((item) => item.order_status === 'verified').length
  const packingCount = queue.filter((item) => item.order_status === 'packing').length
  const shippedCount = queue.filter((item) => item.fulfillment_status === 'shipped').length

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  return (
    <div className="app-page">
      <section className="page-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="page-title">Warehouse queue</h1>
            <p className="page-description">Verified orders flow into packing, tracking, manifests, and shipped status updates.</p>
          </div>
          <Link to="/warehouse/manifests" className="polaris-button polaris-button-secondary">
            <ClipboardList className="h-4 w-4" /> Manifests
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="metric-card">
          <PackageCheck className="h-5 w-5 text-[#008060]" />
          <p className="metric-value mt-4">{readyCount}</p>
          <p className="section-muted">Ready to pack</p>
        </article>
        <article className="metric-card">
          <ScanBarcode className="h-5 w-5 text-[#008060]" />
          <p className="metric-value mt-4">{packingCount}</p>
          <p className="section-muted">Packing now</p>
        </article>
        <article className="metric-card">
          <Truck className="h-5 w-5 text-[#008060]" />
          <p className="metric-value mt-4">{shippedCount}</p>
          <p className="section-muted">Shipped today</p>
        </article>
      </section>

      <section className="section-card">
        <h2 className="section-heading">Packing workflow</h2>
        <div className="mt-4 space-y-3">
          {queue.map((item) => (
            <div key={item.id} className="list-row grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <Link to="/warehouse/$orderId" params={{ orderId: item.id }} className="text-sm font-semibold text-[#202223]">
                  {item.order_number}
                </Link>
                <p className="section-muted mt-1 text-xs">{item.customer_name ?? 'No customer'} • {item.order_status}</p>
              </div>
              <Badge tone={item.order_status === 'verified' ? 'success' : 'warning'}>{item.fulfillment_status ?? item.order_status}</Badge>
              <div className="flex flex-wrap gap-2">
                <button className="polaris-button polaris-button-secondary" onClick={async () => { await pick({ data: { orderId: item.id } }); await router.invalidate() }}>Pick</button>
                <button className="polaris-button polaris-button-secondary" onClick={async () => { await pack({ data: { orderId: item.id } }); await router.invalidate() }}>Pack</button>
                <button className="polaris-button polaris-button-primary" onClick={async () => { await ship({ data: { orderId: item.id } }); await router.invalidate() }}>Ship</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
