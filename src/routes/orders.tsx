import { Link, Outlet, createFileRoute, stripSearchParams, useNavigate, useRouterState } from '@tanstack/react-router'
import { Download, Filter, Search, Tag } from 'lucide-react'
import { z } from 'zod'
import { Badge } from '../components/ui/badge'
import { orderStatusLabels } from '../lib/domain'
import { listOrders } from '../lib/orders.functions'
import { formatMoney, titleCase } from '../lib/utils'

const defaultOrderSearch = {
  platformId: '',
  sellerUserId: '',
  status: '',
  tagId: '',
  website: '',
  search: '',
}

const ordersSearchSchema = z.object({
  platformId: z.string().default(defaultOrderSearch.platformId).catch(defaultOrderSearch.platformId),
  sellerUserId: z.string().default(defaultOrderSearch.sellerUserId).catch(defaultOrderSearch.sellerUserId),
  status: z.string().default(defaultOrderSearch.status).catch(defaultOrderSearch.status),
  tagId: z.string().default(defaultOrderSearch.tagId).catch(defaultOrderSearch.tagId),
  website: z.string().default(defaultOrderSearch.website).catch(defaultOrderSearch.website),
  search: z.string().default(defaultOrderSearch.search).catch(defaultOrderSearch.search),
})

export const Route = createFileRoute('/orders')({
  validateSearch: ordersSearchSchema,
  loaderDeps: ({ search }) => ({
    platformId: search.platformId,
    sellerUserId: search.sellerUserId,
    status: search.status,
    tagId: search.tagId,
    website: search.website,
    search: search.search,
  }),
  loader: ({ deps }) => listOrders({
    data: {
      ...deps,
      platformId: deps.platformId || undefined,
      sellerUserId: deps.sellerUserId || undefined,
      status: deps.status || undefined,
      tagId: deps.tagId || undefined,
      website: deps.website || undefined,
      search: deps.search || undefined,
      limit: 50,
    },
  }),
  search: {
    middlewares: [stripSearchParams(defaultOrderSearch)],
  },
  component: OrdersPage,
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

function formatOrderDate(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: 'Unknown', time: '' }

  return {
    date: new Intl.DateTimeFormat('en-MY', {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
    }).format(date),
    time: new Intl.DateTimeFormat('en-MY', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date).toLowerCase(),
  }
}

function displayPaymentStatus(status: string | null) {
  if (!status) return 'Pending'
  return titleCase(status.replace(/_/g, ' '))
}

function deliveryLabel(row: { platform_option: string | null; tracking_courier: string | null; payment_method: string | null }) {
  const method = row.platform_option || 'Standard'
  const courier = row.tracking_courier || 'DHL'
  const cod = row.payment_method?.toLowerCase() === 'cod'

  return { method: `${method} - ${courier}`, cod }
}

function parseRawItemSummary(value: string | null | undefined) {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => {
      const [rawLabel, rawQuantity] = entry.trim().split(':')
      const label = rawLabel?.trim()
      const quantity = Number(rawQuantity?.trim())

      if (!label) return null

      return {
        label,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      }
    })
    .filter((entry): entry is { label: string; quantity: number } => Boolean(entry))

  if (!entries.length) return null

  return {
    firstLabel: entries[0].label,
    totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    distinctTotal: entries.length,
  }
}

function itemSummary(row: {
  first_item_sku?: string | null
  first_item_name?: string | null
  line_item_distinct_total?: number
  line_item_quantity_total?: number
  item_quantity_total: number
  item_quantity_distinct: number
  platform_option: string | null
  raw_item_quantity_top?: string | null
}) {
  const rawSummary = parseRawItemSummary(row.raw_item_quantity_top)
  const label = row.first_item_sku || titleCase(row.first_item_name) || rawSummary?.firstLabel || titleCase(row.platform_option) || 'No Item'
  const distinctTotal = row.line_item_distinct_total || row.item_quantity_distinct || rawSummary?.distinctTotal || 0
  const quantity = row.line_item_quantity_total || row.item_quantity_total || rawSummary?.totalQuantity || row.item_quantity_distinct || 0
  const extraCount = Math.max(distinctTotal - 1, 0)

  return {
    label: extraCount > 0 ? `${label} + ${extraCount} More` : label,
    quantity,
  }
}

function addressSummary(row: { customer_zip_code: string | null; customer_state: string | null }) {
  const parts = [row.customer_zip_code, titleCase(row.customer_state)].filter(Boolean)
  return parts.length ? parts.join(', ') : 'No Address Captured'
}

function OrdersPage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })
  const navigate = useNavigate({ from: '/orders' })
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const rows = data.rows
  const hasFilters = Boolean(search.platformId || search.sellerUserId || search.status || search.tagId || search.website || search.search)

  function updateSearch(updates: Partial<typeof search>) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...updates,
      }),
    })
  }

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">All Orders</h1>
          <p className="page-description">Manage and view orders from the current authenticated sales scope.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Tag className="h-5 w-5 text-[#2c5cc5]" />
          <button className="polaris-button polaris-button-primary px-6">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </section>

      <section className="order-toolbar">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3">
            <button className="w-fit border-b-2 border-[#2c5cc5] px-3 py-2 text-sm font-semibold text-[#2c5cc5]">Sales Team</button>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select className="order-filter-select" value={search.platformId} aria-label="Select Platform" onChange={(event) => updateSearch({ platformId: event.target.value })}>
                <option value="">Select Platform</option>
                {data.filters.platforms.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select className="order-filter-select" value={search.sellerUserId} aria-label="Select User" onChange={(event) => updateSearch({ sellerUserId: event.target.value })}>
                <option value="">Select User</option>
                {data.filters.users.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select className="order-filter-select" value={search.status} aria-label="Select Order Status" onChange={(event) => updateSearch({ status: event.target.value })}>
                <option value="">Select Order Status</option>
                {data.filters.statuses.map((option) => (
                  <option key={option.value} value={option.value}>{orderStatusLabels[option.value as keyof typeof orderStatusLabels] ?? titleCase(option.label.replace(/_/g, ' '))}</option>
                ))}
              </select>
              <select className="order-filter-select" value={search.tagId} aria-label="Select Tags" onChange={(event) => updateSearch({ tagId: event.target.value })}>
                <option value="">Select Tags</option>
                {data.filters.tags.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select className="order-filter-select" value={search.website} aria-label="Select Websites" onChange={(event) => updateSearch({ website: event.target.value })}>
                <option value="">Select Websites</option>
                {data.filters.websites.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-[420px]">
            <label className="control-surface flex min-w-0 flex-1 items-center gap-2 px-3 text-sm">
              <Search className="h-4 w-4 shrink-0 text-[#616161]" />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent py-2 outline-none"
                placeholder="Search"
                value={search.search}
                onChange={(event) => updateSearch({ search: event.target.value })}
              />
            </label>
            <button className="polaris-button polaris-button-secondary px-5" type="button" disabled={!hasFilters} onClick={() => updateSearch({ platformId: '', sellerUserId: '', status: '', tagId: '', website: '', search: '' })}>
              <Filter className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>
      </section>

      <section className="table-card order-table-card">
        <div className="overflow-x-auto">
          <table className="data-table order-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input type="checkbox" aria-label="Select all orders" />
                </th>
                <th>Order date</th>
                <th>Order ID</th>
                <th>Item / Quantity</th>
                <th>Customer</th>
                <th>Delivery Method</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const createdAt = formatOrderDate(row.created_at)
                const delivery = deliveryLabel(row)
                const website = row.order_website || row.platform_name
                const item = itemSummary(row)

                return (
                  <tr key={row.id}>
                    <td>
                      <input type="checkbox" aria-label={`Select order ${row.order_number}`} />
                    </td>
                    <td className="order-date-cell">
                      <span>{createdAt.date}</span>
                      <span>{createdAt.time}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusTone(row.order_status)}>{orderStatusLabels[row.order_status as keyof typeof orderStatusLabels] ?? row.order_status}</Badge>
                        {website ? <span className="order-website-chip">{website}</span> : null}
                      </div>
                      <Link to="/orders/$orderId" params={{ orderId: row.id }} className="mt-2 block text-base font-semibold text-[#303030] hover:text-[#005bd3]">
                        {row.order_number}
                      </Link>
                      <p className="mt-1 text-sm text-[#616161]">{row.platform_category || 'Sales Team'}</p>
                      <p className="mt-2 text-sm text-[#616161]">{row.seller_name ?? 'Unassigned'}</p>
                    </td>
                    <td className="font-semibold text-[#202223]">
                      <div className="flex items-center gap-8">
                        <span>{item.label}</span>
                        <span>{item.quantity}</span>
                      </div>
                    </td>
                    <td>
                      <p className="font-semibold text-[#202223]">{titleCase(row.customer_name) || 'Walk-In / Unknown'}</p>
                      {row.customer_phone ? <p className="mt-2 text-[#202223]">{row.customer_phone}</p> : null}
                      <p className="mt-3 max-w-[260px] text-[#202223]">
                        {addressSummary(row)}
                      </p>
                    </td>
                    <td>
                      <p className="text-[#202223]">{delivery.method}</p>
                      {delivery.cod ? <span className="order-cod-chip mt-4">COD</span> : null}
                    </td>
                    <td>
                      <Badge tone={paymentTone(row.payment_status)}>{displayPaymentStatus(row.payment_status)}</Badge>
                      <p className="mt-5 font-semibold text-[#202223]">{formatMoney(Number(row.total_amount), row.currency)}</p>
                      <p className="mt-5 text-[#202223]">{item.quantity} items</p>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#616161]">
                    No orders found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
