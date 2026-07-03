import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, ExternalLink, Mail, Package, Phone, UserRound } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { getCustomerDetail } from '../lib/customers.functions'
import { formatInternationalPhone, formatMoney, titleCase } from '../lib/utils'

export const Route = createFileRoute('/customers/$customerId')({
  loader: ({ params }) => getCustomerDetail({ data: { customerId: params.customerId } }),
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const data = Route.useLoaderData()

  if (!data) {
    return (
      <div className="app-page">
        <section className="section-card">
          <h1 className="page-title">Customer not found</h1>
          <p className="page-description">The requested customer is outside the current sales scope or has not been imported yet.</p>
        </section>
      </div>
    )
  }

  const { customer, orders } = data
  const lifetimeOrders = Number(customer.lifetime_orders)
  const lifetimeValue = Number(customer.lifetime_value)
  const aov = lifetimeOrders > 0 ? lifetimeValue / lifetimeOrders : 0

  return (
    <div className="app-page customer-detail-page">
      <section className="page-header">
        <Link from={Route.fullPath} to="/customers" className="customer-back-button">
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>
        <div>
          <h1 className="page-title">{titleCase(customer.name)}</h1>
          <p className="page-description">Customer profile, purchase history, and seller ownership scope.</p>
        </div>
      </section>

      <section className="customer-detail-metrics">
        <article className="customer-metric-card">
          <p className="customer-metric-label">Order(s)</p>
          <p className="customer-metric-value">{lifetimeOrders.toLocaleString('en-MY')}</p>
        </article>
        <article className="customer-metric-card">
          <p className="customer-metric-label">Total Spend</p>
          <p className="customer-metric-value">{formatMoney(lifetimeValue)}</p>
        </article>
        <article className="customer-metric-card">
          <p className="customer-metric-label">Last Ordered</p>
          <p className="customer-metric-value customer-metric-value-long">{formatCustomerDate(customer.last_order_date)}</p>
        </article>
        <article className="customer-metric-card">
          <p className="customer-metric-label">AOV</p>
          <p className="customer-metric-value">{formatMoney(aov)}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="customer-detail-card">
          <div className="customer-detail-card-header">
            <span className="customer-detail-icon"><UserRound className="h-4 w-4" /></span>
            <h2 className="section-heading">Contact</h2>
          </div>
          <div className="customer-detail-list">
            <div className="customer-detail-row">
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-[#616161]" /> Email</span>
              <span className="font-semibold">{customer.email ?? 'No email'}</span>
            </div>
            <div className="customer-detail-row">
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-[#616161]" /> Phone</span>
              <span className="font-semibold">{formatInternationalPhone(customer.phone, customer.country) || 'No phone'}</span>
            </div>
            <div className="customer-detail-row">
              <span>Sellers</span>
              <span className="font-semibold">{customer.seller_names || 'Unassigned'}</span>
            </div>
          </div>
        </article>
        <article className="customer-detail-card">
          <div className="customer-detail-card-header">
            <h2 className="section-heading">Address</h2>
          </div>
          <p className="customer-detail-address">
            {[titleCase(customer.address_line), titleCase(customer.city), titleCase(customer.state), titleCase(customer.country), customer.zip_code].filter(Boolean).join(', ') || 'No address captured yet.'}
          </p>
          {customer.note ? <p className="section-muted mt-4 text-sm">Note: {customer.note}</p> : null}
        </article>
      </section>

      <section className="customer-history-card">
        <div className="customer-history-header">
          <span className="customer-detail-icon"><Package className="h-4 w-4" /></span>
          <h2 className="section-heading">Purchase history</h2>
        </div>

        <div className="customer-history-list">
          {orders.map((order, index) => {
            const itemsTotal = order.items.reduce((sum, item) => sum + item.quantity, 0)

            return (
              <details key={order.id} className="customer-history-item" open={index === 0}>
                <summary className="customer-history-summary">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <span className="font-semibold text-[#303030]">Order ID: {order.order_number}</span>
                    <Link to="/orders/$orderId" params={{ orderId: order.id }} className="polaris-button polaris-button-secondary min-h-8 px-3" onClick={(event) => event.stopPropagation()}>
                      View <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <Badge tone={order.order_status === 'completed' || order.order_status === 'shipped' ? 'success' : 'info'}>{titleCase(order.order_status.replace(/_/g, ' '))}</Badge>
                    <ChevronDown className="h-5 w-5 text-[#616161]" />
                  </div>
                </summary>

                <div className="customer-history-body">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Field label="Purchased On" value={formatCustomerDate(order.created_at)} />
                    <Field label="Payment Method" value={order.payment_method || 'Unknown'} />
                    <Field label="Seller" value={order.seller_name || 'Unassigned'} />
                    <Field label="Source" value={order.order_website || order.platform_category || 'Sales Team'} />
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="data-table customer-history-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Step</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={`${order.id}-${item.product_sku ?? item.product_name}-${item.quantity}`}>
                            <td>{titleCase(item.product_name) || item.product_sku || 'Product'}</td>
                            <td><Badge tone="neutral">{item.quantity.toLocaleString('en-MY')} item{item.quantity === 1 ? '' : 's'}</Badge></td>
                            <td>{formatMoney(Number(item.order_line_total), order.currency)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td>Shipping</td>
                          <td><Badge tone="neutral">Shipping</Badge></td>
                          <td>{formatMoney(Number(order.shipping_total), order.currency)}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Total</td>
                          <td className="font-semibold">{itemsTotal.toLocaleString('en-MY')} items</td>
                          <td className="font-semibold">{formatMoney(Number(order.total_amount), order.currency)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )
          })}
          {orders.length === 0 ? <p className="section-muted py-6 text-center">No purchases found for this customer.</p> : null}
        </div>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="font-semibold text-[#8a8a8a]">{label}</span>
      <span className="text-[#303030]">{value}</span>
    </div>
  )
}

function formatCustomerDate(value: Date | string | null) {
  if (!value) return 'No orders yet'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
