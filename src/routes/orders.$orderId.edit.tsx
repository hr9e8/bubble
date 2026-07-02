import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Save } from 'lucide-react'
import { useState } from 'react'
import { orderStatusLabels, type OrderStatus } from '../lib/domain'
import { getOrderDetail, updateOrder } from '../lib/orders.functions'

export const Route = createFileRoute('/orders/$orderId/edit')({
  loader: ({ params }) => getOrderDetail({ data: { orderId: params.orderId } }),
  component: EditOrderPage,
})

type CustomerForm = {
  name: string
  email: string
  phone: string
  addressLine: string
  city: string
  state: string
  country: string
  zipCode: string
}

function readSnapshotValue(snapshot: unknown, keys: Array<string>) {
  if (!snapshot || typeof snapshot !== 'object') return ''
  let current: unknown = snapshot

  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) return ''
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' ? current : ''
}

function EditOrderPage() {
  const data = Route.useLoaderData()
  const { orderId } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const updateOrderFn = useServerFn(updateOrder)
  const order = data?.order
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState(order?.order_number ?? '')
  const [orderWebsite, setOrderWebsite] = useState(order?.order_website ?? '')
  const [platformCategory, setPlatformCategory] = useState(order?.platform_category ?? '')
  const [platformOption, setPlatformOption] = useState(order?.platform_option ?? '')
  const [orderStatus, setOrderStatus] = useState<OrderStatus>((order?.order_status as OrderStatus | undefined) ?? 'pending_payment')
  const [noteSummary, setNoteSummary] = useState(order?.note_summary ?? '')
  const [cancellationReason, setCancellationReason] = useState(order?.cancellation_reason ?? '')
  const snapshotName = readSnapshotValue(order?.customer_snapshot, ['billing', 'name'])
    || [
      readSnapshotValue(order?.customer_snapshot, ['billing', 'first_name']),
      readSnapshotValue(order?.customer_snapshot, ['billing', 'last_name']),
    ].filter(Boolean).join(' ')
  const [customer, setCustomer] = useState<CustomerForm>({
    name: order?.customer_name ?? snapshotName,
    email: order?.customer_email ?? readSnapshotValue(order?.customer_snapshot, ['billing', 'email']),
    phone: order?.customer_phone ?? readSnapshotValue(order?.customer_snapshot, ['billing', 'phone']),
    addressLine: order?.customer_address_line ?? readSnapshotValue(order?.customer_snapshot, ['shipping', 'address_1']),
    city: order?.customer_city ?? readSnapshotValue(order?.customer_snapshot, ['shipping', 'city']),
    state: order?.customer_state ?? readSnapshotValue(order?.customer_snapshot, ['shipping', 'state']),
    country: order?.customer_country ?? readSnapshotValue(order?.customer_snapshot, ['shipping', 'country']),
    zipCode: order?.customer_zip_code ?? readSnapshotValue(order?.customer_snapshot, ['shipping', 'postcode']),
  })

  if (!data || !order) {
    return (
      <div className="app-page">
        <section className="section-card">
          <h1 className="page-title">Order not found</h1>
          <p className="page-description">The requested order was not found in the scoped dataset.</p>
          <Link to="/orders" className="polaris-button polaris-button-secondary mt-4">Back to orders</Link>
        </section>
      </div>
    )
  }

  function updateCustomerField(field: keyof CustomerForm, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await updateOrderFn({
        data: {
          orderId,
          orderNumber,
          orderWebsite,
          platformCategory,
          platformOption,
          orderStatus,
          noteSummary,
          cancellationReason,
          customer,
        },
      })
      await router.invalidate({ sync: true })
      await navigate({ to: '/orders/$orderId', params: { orderId } })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to update order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="app-page" onSubmit={handleSubmit}>
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Edit {order.order_number}</h1>
          <p className="page-description">Update controlled order fields while preserving finance and warehouse processing decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/orders/$orderId" params={{ orderId }} className="polaris-button polaris-button-secondary">
            Cancel
          </Link>
          <button className="polaris-button polaris-button-primary" type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <article className="section-card">
            <h2 className="section-heading">Customer snapshot</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="form-field md:col-span-2">
                <span className="form-label">Customer name</span>
                <input className="form-input" value={customer.name} onChange={(event) => updateCustomerField('name', event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Email</span>
                <input className="form-input" type="email" value={customer.email} onChange={(event) => updateCustomerField('email', event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Phone</span>
                <input className="form-input" value={customer.phone} onChange={(event) => updateCustomerField('phone', event.target.value)} />
              </label>
              <label className="form-field md:col-span-2">
                <span className="form-label">Address line</span>
                <input className="form-input" value={customer.addressLine} onChange={(event) => updateCustomerField('addressLine', event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">City</span>
                <input className="form-input" value={customer.city} onChange={(event) => updateCustomerField('city', event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">State</span>
                <input className="form-input" value={customer.state} onChange={(event) => updateCustomerField('state', event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Country</span>
                <input className="form-input" value={customer.country} onChange={(event) => updateCustomerField('country', event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Zip code</span>
                <input className="form-input" value={customer.zipCode} onChange={(event) => updateCustomerField('zipCode', event.target.value)} />
              </label>
            </div>
          </article>

          <article className="section-card">
            <h2 className="section-heading">Platform and website</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="form-field">
                <span className="form-label">Order number</span>
                <input className="form-input" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} required />
              </label>
              <label className="form-field">
                <span className="form-label">Website</span>
                <input className="form-input" value={orderWebsite} onChange={(event) => setOrderWebsite(event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Platform category</span>
                <input className="form-input" value={platformCategory} onChange={(event) => setPlatformCategory(event.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Platform option</span>
                <input className="form-input" value={platformOption} onChange={(event) => setPlatformOption(event.target.value)} />
              </label>
            </div>
          </article>
        </div>

        <aside className="grid content-start gap-4">
          <article className="section-card">
            <h2 className="section-heading">Status</h2>
            <div className="mt-4 grid gap-3">
              <label className="form-field">
                <span className="form-label">Order status</span>
                <select className="form-select" value={orderStatus} onChange={(event) => setOrderStatus(event.target.value as OrderStatus)}>
                  {Object.entries(orderStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Cancellation reason</span>
                <textarea
                  className="form-textarea"
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                  disabled={orderStatus !== 'cancelled'}
                  required={orderStatus === 'cancelled'}
                />
              </label>
            </div>
          </article>

          <article className="section-card">
            <h2 className="section-heading">Notes</h2>
            <label className="form-field mt-4">
              <span className="form-label">Tag or note summary</span>
              <textarea className="form-textarea" value={noteSummary} onChange={(event) => setNoteSummary(event.target.value)} />
            </label>
          </article>
        </aside>
      </section>
    </form>
  )
}
