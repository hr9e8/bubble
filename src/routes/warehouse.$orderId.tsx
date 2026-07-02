import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Badge } from '../components/ui/badge'
import { getWarehouseOrderDetail, markOrderPacked, markOrderPicked, markOrderShipped, updateTracking } from '../lib/warehouse.functions'

export const Route = createFileRoute('/warehouse/$orderId')({
  loader: ({ params }) => getWarehouseOrderDetail({ data: { orderId: params.orderId } }),
  component: WarehouseOrderPage,
})

function WarehouseOrderPage() {
  const router = useRouter()
  const data = Route.useLoaderData()
  const pick = useServerFn(markOrderPicked)
  const pack = useServerFn(markOrderPacked)
  const ship = useServerFn(markOrderShipped)
  const tracking = useServerFn(updateTracking)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [courierName, setCourierName] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [shipmentId, setShipmentId] = useState('')
  const [awbLabelUrl, setAwbLabelUrl] = useState('')

  if (!data) {
    return (
      <div className="app-page">
        <section className="section-card p-4">
          <h1 className="page-title">Warehouse order not found</h1>
        </section>
      </div>
    )
  }

  const { order, items, events } = data

  async function refresh(action: Promise<unknown>) {
    await action
    await router.invalidate()
  }

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Warehouse order {order.order_number}</h1>
          <p className="page-description">{order.customer_name ?? 'No customer'} · {order.payment_status ?? 'pending payment'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="polaris-button polaris-button-secondary" onClick={() => refresh(pick({ data: { orderId: order.id } }))}>Pick</button>
          <button className="polaris-button polaris-button-secondary" onClick={() => refresh(pack({ data: { orderId: order.id } }))}>Pack</button>
          <button className="polaris-button polaris-button-primary" onClick={() => refresh(ship({ data: { orderId: order.id } }))}>Ship</button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <article className="section-card p-4">
          <h2 className="section-heading">Pick list</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="list-row flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-semibold text-[#202223]">{item.product_name ?? 'Custom item'}</p>
                  <p className="section-muted mt-1 text-xs">{item.sku_code ?? 'No SKU'}</p>
                </div>
                <span className="font-semibold">Qty {item.quantity}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="section-card p-4">
          <h2 className="section-heading">Tracking</h2>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void refresh(tracking({ data: { orderId: order.id, trackingNumber, courierName, trackingUrl: trackingUrl || undefined, shipmentId: shipmentId || undefined, awbLabelUrl: awbLabelUrl || undefined } }))
            }}
          >
            <input className="form-input" value={courierName} onChange={(event) => setCourierName(event.target.value)} placeholder="Courier" />
            <input className="form-input" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Tracking or AWB number" required />
            <input className="form-input" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="Tracking URL" />
            <input className="form-input" value={shipmentId} onChange={(event) => setShipmentId(event.target.value)} placeholder="Shipment ID" />
            <input className="form-input" value={awbLabelUrl} onChange={(event) => setAwbLabelUrl(event.target.value)} placeholder="AWB / label file URL" />
            <button className="polaris-button polaris-button-primary" type="submit">Save tracking</button>
          </form>
        </aside>
      </section>

      <section className="section-card p-4">
        <h2 className="section-heading">Warehouse events</h2>
        <div className="mt-4 space-y-2">
          {events.map((event) => (
            <div key={event.id} className="list-row flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div>
                <Badge tone={event.event_type === 'shipped' ? 'success' : 'neutral'}>{event.event_type}</Badge>
                <span className="ml-3 text-[#616161]">{new Date(event.created_at).toLocaleString()}</span>
              </div>
              {event.awb_label_url ? <a className="font-semibold text-[#006e52]" href={event.awb_label_url} target="_blank" rel="noreferrer">{event.awb_label_filename ?? 'AWB label'}</a> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
