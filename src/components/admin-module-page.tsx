import { Filter, Plus, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from './ui/badge'
import { formatNumber } from '../lib/utils'

type AdminMetric = {
  label: string
  value: number | string
  detail?: string
}

type AdminColumn<Row> = {
  header: string
  cell: (row: Row) => ReactNode
  className?: string
}

type AdminModulePageProps<Row> = {
  title: string
  description: string
  badge: string
  primaryAction?: string
  onPrimaryAction?: () => void
  metrics: Array<AdminMetric>
  rows: Array<Row>
  columns: Array<AdminColumn<Row>>
  rowActions?: (row: Row) => ReactNode
  getRowKey: (row: Row) => string
  searchPlaceholder: string
  emptyMessage: string
  children?: ReactNode
}

function displayMetric(value: number | string) {
  return typeof value === 'number' ? formatNumber(value) : value
}

export function AdminModulePage<Row>({
  title,
  description,
  badge,
  primaryAction,
  onPrimaryAction,
  metrics,
  rows,
  columns,
  rowActions,
  getRowKey,
  searchPlaceholder,
  emptyMessage,
  children,
}: AdminModulePageProps<Row>) {
  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{title}</h1>
            <Badge tone="info">{badge}</Badge>
          </div>
          <p className="page-description">{description}</p>
        </div>
        {primaryAction ? (
          <button className="polaris-button polaris-button-primary" type="button" onClick={onPrimaryAction}>
            <Plus className="h-4 w-4" />
            {primaryAction}
          </button>
        ) : null}
      </section>

      {metrics.length > 0 ? (
        <section className="metric-row">
          {metrics.map((metric) => (
            <article key={metric.label} className="metric-card">
              <p className="metric-label">{metric.label}</p>
              <p className="metric-value mt-2">{displayMetric(metric.value)}</p>
              {metric.detail ? <p className="section-muted mt-2">{metric.detail}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      {children}

      <section className="section-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="control-surface flex min-w-0 items-center gap-2 px-3 text-sm lg:w-[26rem]">
            <Search className="h-4 w-4 shrink-0 text-[#616161]" />
            <input className="min-w-0 flex-1 border-0 bg-transparent py-2 outline-none" placeholder={searchPlaceholder} />
          </label>
          <button className="polaris-button polaris-button-secondary w-fit">
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </section>

      <section className="table-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.header} className={column.className}>
                    {column.header}
                  </th>
                ))}
                {rowActions ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={getRowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.header} className={column.className}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions ? <td>{rowActions(row)}</td> : null}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (rowActions ? 1 : 0)} className="py-12 text-center text-[#616161]">
                    {emptyMessage}
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
