import { Link, createFileRoute } from '@tanstack/react-router'
import { Barcode, ClipboardList, PackageSearch, Scale, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/badge'
import { listWarehouseManifests } from '../lib/warehouse.functions'
import { titleCase } from '../lib/utils'

export const Route = createFileRoute('/warehouse/manifests')({
  loader: () => listWarehouseManifests({ data: { limit: 100 } }),
  component: WarehouseManifestsPage,
})

function formatManifestDate(value: Date | string | null) {
  if (!value) return 'No manifest date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No manifest date'

  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function fulfillmentTone(status: string | null) {
  if (status === 'shipped') return 'success'
  if (status === 'packed' || status === 'packing') return 'warning'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

function WarehouseManifestsPage() {
  const { rows, stats } = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows

    return rows.filter((row) => {
      const fields = [
        row.order_number,
        row.group_manifest_id,
        row.shipping_awb_no,
        row.shipping_awb_barcode,
        row.shipping_courier_name,
        row.custom_courier,
        row.handler_data,
      ]

      return fields.some((field) => field?.toLowerCase().includes(normalizedQuery))
    })
  }, [normalizedQuery, rows])

  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">Warehouse manifests</h1>
          <p className="page-description">Review Bubble manifest rows, AWB references, courier names, weights, handler data, and their linked warehouse orders.</p>
        </div>
        <Link to="/warehouse" className="polaris-button polaris-button-secondary">
          Back to queue
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <article className="metric-card">
          <ClipboardList className="h-5 w-5 text-[#008060]" />
          <p className="metric-value mt-4">{stats.manifestCount}</p>
          <p className="section-muted">Manifest rows</p>
        </article>
        <article className="metric-card">
          <PackageSearch className="h-5 w-5 text-[#2c5cc5]" />
          <p className="metric-value mt-4">{stats.groupCount}</p>
          <p className="section-muted">Group manifests</p>
        </article>
        <article className="metric-card">
          <Barcode className="h-5 w-5 text-[#8a6116]" />
          <p className="metric-value mt-4">{stats.awbCount}</p>
          <p className="section-muted">AWB references</p>
        </article>
        <article className="metric-card">
          <Scale className="h-5 w-5 text-[#616161]" />
          <p className="metric-value mt-4">{stats.totalWeight.toLocaleString('en-MY', { maximumFractionDigits: 1 })} kg</p>
          <p className="section-muted">Recorded weight</p>
        </article>
      </section>

      <section className="section-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="section-heading">Manifest records</h2>
            <p className="section-muted mt-1">Showing {filteredRows.length} of the latest {rows.length} loaded rows.</p>
          </div>
          <label className="control-surface flex min-w-0 items-center gap-2 px-3 text-sm md:w-[360px]">
            <Search className="h-4 w-4 shrink-0 text-[#616161]" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent py-2 outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search order, AWB, courier, group"
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Manifest</th>
                <th>AWB</th>
                <th>Courier</th>
                <th>Order status</th>
                <th>Weight</th>
                <th>Handler</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <p className="text-xs font-semibold uppercase text-[#616161]">{formatManifestDate(row.manifest_datetime)}</p>
                    {row.order_id ? (
                      <Link to="/warehouse/$orderId" params={{ orderId: row.order_id }} className="mt-2 block text-base font-semibold text-[#303030] hover:text-[#005bd3]">
                        {row.order_number}
                      </Link>
                    ) : (
                      <p className="mt-2 text-base font-semibold text-[#303030]">{row.order_number}</p>
                    )}
                    <p className="mt-1 text-sm text-[#616161]">{row.group_manifest_id || 'No group manifest'}</p>
                  </td>
                  <td>
                    <p className="font-semibold text-[#202223]">{row.shipping_awb_no || 'No AWB number'}</p>
                    <p className="mt-1 max-w-[260px] truncate text-sm text-[#616161]">{row.shipping_awb_barcode || row.tracking_number || 'No barcode'}</p>
                    {row.tracking_url ? (
                      <a className="mt-2 inline-block text-sm font-semibold text-[#006e52]" href={row.tracking_url} target="_blank" rel="noreferrer">
                        Open tracking
                      </a>
                    ) : null}
                  </td>
                  <td>
                    <p className="font-semibold text-[#202223]">{row.shipping_courier_name || row.custom_courier || 'No courier'}</p>
                    {row.custom_courier ? <p className="mt-1 text-sm text-[#616161]">Custom: {row.custom_courier}</p> : null}
                  </td>
                  <td>
                    {row.order_id ? (
                      <div className="grid gap-2">
                        <Badge tone={fulfillmentTone(row.fulfillment_status ?? row.order_status)}>{titleCase((row.fulfillment_status ?? row.order_status ?? 'linked').replace(/_/g, ' '))}</Badge>
                        <span className="text-sm text-[#616161]">Linked order</span>
                      </div>
                    ) : (
                      <Badge tone="neutral">Unlinked</Badge>
                    )}
                  </td>
                  <td>
                    <p className="font-semibold text-[#202223]">{row.weight == null ? 'No weight' : `${row.weight.toLocaleString('en-MY', { maximumFractionDigits: 3 })} kg`}</p>
                  </td>
                  <td>
                    <p className="max-w-[300px] whitespace-pre-wrap text-sm text-[#202223]">{row.handler_data || 'No handler data'}</p>
                    <p className="mt-2 text-xs text-[#616161]">{row.created_by || 'Unknown creator'}</p>
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-[#616161]">
                    No manifests match the current search.
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
