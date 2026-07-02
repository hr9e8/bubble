import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronDown, Upload } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { orderStatusLabels } from '../lib/domain'
import { getOrderDetail } from '../lib/orders.functions'
import { formatMoney, titleCase } from '../lib/utils'

export const Route = createFileRoute('/orders/$orderId')({
  loader: ({ params }) => getOrderDetail({ data: { orderId: params.orderId } }),
  component: OrderDetailPage,
})

function statusTone(status: string) {
  if (status === 'verified' || status === 'shipped') return 'success'
  if (status === 'pending_payment' || status === 'packing') return 'warning'
  if (status === 'cancelled') return 'danger'
  return 'info'
}

function paymentTone(status: string | null) {
  if (status === 'verified') return 'success'
  if (status === 'not_verified' || status === 'Not verified') return 'info'
  if (status === 'rejected' || status === 'cancelled') return 'danger'
  return 'neutral'
}

function displayStatus(status: string | null | undefined) {
  if (!status) return 'Pending'
  return titleCase(status.replace(/_/g, ' '))
}

function readSnapshotValue(snapshot: unknown, keys: Array<string>) {
  if (!snapshot || typeof snapshot !== 'object') return null
  let current: unknown = snapshot

  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) return null
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' && current.trim() ? current : null
}

function parseRawItemSummary(value: string | null | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry, index) => {
      const [rawLabel, rawQuantity] = entry.trim().split(':')
      const label = rawLabel?.trim()
      const quantity = Number(rawQuantity?.trim())

      if (!label) return null

      return {
        id: `raw-item-${index}`,
        product_name: label,
        product_sku: label,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      }
    })
    .filter((entry): entry is { id: string; product_name: string; product_sku: string; quantity: number } => Boolean(entry))
}

function OrderDetailPage() {
  const data = Route.useLoaderData()

  if (!data) {
    return (
      <div className="app-page">
        <section className="section-card">
          <h1 className="page-title">Order not found</h1>
          <p className="page-description">The requested order was not found in the scoped dataset.</p>
        </section>
      </div>
    )
  }

  const { order, items } = data
  const subtotal = Number(order.subtotal_amount)
  const shippingTotal = Number(order.shipping_total)
  const codFee = Number(order.cod_fee)
  const transactionFee = Number(order.transaction_fee)
  const discountAmount = Number(order.discount_amount)
  const tax = 0
  const snapshotFirstName = readSnapshotValue(order.customer_snapshot, ['billing', 'first_name'])
  const snapshotLastName = readSnapshotValue(order.customer_snapshot, ['billing', 'last_name'])
  const customerName = titleCase(order.customer_name || [snapshotFirstName, snapshotLastName].filter(Boolean).join(' ') || 'Walk-in / unknown')
  const customerEmail = order.customer_email || readSnapshotValue(order.customer_snapshot, ['billing', 'email']) || ''
  const customerPhone = order.customer_phone || readSnapshotValue(order.customer_snapshot, ['billing', 'phone']) || ''
  const addressLine = titleCase(order.customer_address_line || readSnapshotValue(order.customer_snapshot, ['shipping', 'address_1']) || '')
  const city = titleCase(order.customer_city || readSnapshotValue(order.customer_snapshot, ['shipping', 'city']) || '')
  const state = titleCase(order.customer_state || readSnapshotValue(order.customer_snapshot, ['shipping', 'state']) || '')
  const zipCode = order.customer_zip_code || readSnapshotValue(order.customer_snapshot, ['shipping', 'postcode']) || ''
  const deliveryMethod = `${order.platform_option || 'Standard'} - ${order.tracking_courier || 'DHL'}`
  const displayItems = items.length ? items : parseRawItemSummary(order.raw_item_quantity_top)

  return (
    <div className="order-detail-page">
      <section className="order-detail-heading">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-[#111111]">{order.order_number}</h1>
          <Badge tone={statusTone(order.order_status)}>{orderStatusLabels[order.order_status as keyof typeof orderStatusLabels] ?? displayStatus(order.order_status)}</Badge>
          {order.order_website || order.platform_name ? <span className="order-website-chip">{order.order_website || order.platform_name}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/orders" className="polaris-button polaris-button-secondary min-w-36 border-[#008060] text-[#006e52]">
            Go Back
          </Link>
          <Link to="/orders/$orderId/edit" params={{ orderId: order.id }} className="polaris-button polaris-button-secondary min-w-32">
            Edit order
          </Link>
          <button className="polaris-button polaris-button-primary min-w-40">
            More Actions <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="section-card order-detail-card">
          <h2 className="text-lg font-bold text-[#111111]">Order Items</h2>
          <div className="mt-5 space-y-4">
            {displayItems.map((item, index) => (
              <div key={item.id} className={index % 2 === 1 ? 'order-item-row order-item-row-tint' : 'order-item-row'}>
                <div className="order-item-thumb">
                  {item.product_sku?.slice(0, 3) ?? 'SKU'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[#616161]">{item.product_name ?? 'Bundle / custom item'} | {item.quantity} unit</p>
                  <p className="mt-1 text-[#616161]">{item.product_sku ?? 'No SKU'}</p>
                </div>
                <span className="ml-auto font-semibold text-[#616161]">{item.quantity}</span>
              </div>
            ))}
          </div>

          <section className="mt-7">
            <h2 className="text-lg font-bold text-[#111111]">Customer Details</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="form-field">
                <span className="form-label">Name</span>
                <input className="form-input" value={customerName} readOnly />
              </label>
              <label className="form-field">
                <span className="form-label">Email</span>
                <input className="form-input" value={customerEmail} readOnly />
              </label>
              <label className="form-field">
                <span className="form-label">Phone Number</span>
                <input className="form-input" value={customerPhone} readOnly />
              </label>
              <label className="form-field md:col-span-3">
                <span className="form-label">Address Line</span>
                <input className="form-input" value={addressLine} readOnly />
              </label>
              <label className="form-field">
                <span className="form-label">City</span>
                <input className="form-input" value={city} readOnly />
              </label>
              <label className="form-field">
                <span className="form-label">State</span>
                <input className="form-input" value={state} readOnly />
              </label>
              <label className="form-field">
                <span className="form-label">Zip Code</span>
                <input className="form-input" value={zipCode} readOnly />
              </label>
            </div>
          </section>

          <section className="order-total-section">
            <h2 className="text-lg font-bold text-[#111111]">Shipping Details</h2>
            <DetailLine label="Total Weight" value="-" />
            <DetailLine label={`Shipping : ${deliveryMethod}`} value={formatMoney(shippingTotal, order.currency)} />
            <DetailLine label={`COD : ${order.payment_method?.toLowerCase() === 'cod' ? 'Enabled' : 'None'}`} value={formatMoney(codFee, order.currency)} />
            <DetailLine label="Shipping Discount :" value={formatMoney(discountAmount, order.currency)} />
            <DetailLine label="Shipping Total" value={formatMoney(shippingTotal, order.currency)} />
          </section>

          <section className="order-total-section">
            <h2 className="text-lg font-bold text-[#111111]">Order Total</h2>
            <DetailLine label="Subtotal" value={formatMoney(subtotal, order.currency)} />
            <DetailLine label="Shipping Total" value={formatMoney(shippingTotal, order.currency)} />
            <DetailLine label="Extras: Fixed Processing Fee" value={formatMoney(transactionFee, order.currency)} />
            <DetailLine label="Tax" value={formatMoney(tax, order.currency)} />
            <DetailLine label="Total" value={formatMoney(Number(order.total_amount), order.currency)} strong />
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-bold text-[#111111]">Receipt</h2>
            <div className="order-upload-box mt-4">
              <Upload className="h-5 w-5 text-[#616161]" />
              <span>Drop files here to upload (or click)</span>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-bold text-[#111111]">Woocommerce Info</h2>
            <div className="mt-4 grid gap-4 text-sm text-[#111111]">
              <p>Website: {order.order_website || order.platform_name || 'None'}</p>
              <p>Order ID: {order.woo_order_id || 'None'}</p>
              <p>Transaction ID: {order.woo_transaction_id || 'None'}</p>
            </div>
          </section>
        </article>

        <aside className="order-side-panel">
          <section className="section-card">
            <h2 className="font-bold text-[#111111]">Order Status</h2>
            <div className="mt-3">
              <Badge tone={statusTone(order.order_status)}>{orderStatusLabels[order.order_status as keyof typeof orderStatusLabels] ?? displayStatus(order.order_status)}</Badge>
            </div>
            <label className="form-field mt-5">
              <span className="form-label">Change order status</span>
              <select className="form-select" defaultValue={order.order_status}>
                {Object.entries(orderStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button className="polaris-button polaris-button-secondary mt-2 w-full" disabled>Update Status</button>
            <div className="mt-4">
              <Badge tone={paymentTone(order.payment_status)}>{displayStatus(order.payment_status)}</Badge>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-[#111111]">Tag</h2>
            <input className="form-input" value={order.note_summary || 'None'} readOnly />
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-[#111111]">Notes</h2>
            <textarea className="form-textarea min-h-44" defaultValue={order.customer_note || order.note_summary || ''} />
            <div className="mt-3 flex gap-3">
              <select className="form-select max-w-32" defaultValue="public">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <button className="polaris-button polaris-button-primary px-6">Add</button>
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}

function DetailLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="order-detail-line">
      <span className={strong ? 'font-bold text-[#111111]' : ''}>{label}</span>
      <span className={strong ? 'font-bold text-[#111111]' : 'font-semibold text-[#111111]'}>{value}</span>
    </div>
  )
}
