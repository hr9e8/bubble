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
  getRowClassName?: (row: Row) => string | undefined
  searchPlaceholder: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  showSearch?: boolean
  showFilter?: boolean
  emptyMessage: string
  tableFooter?: ReactNode
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
  getRowClassName,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  showSearch = true,
  showFilter = true,
  emptyMessage,
  tableFooter,
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
          {description ? <p className="page-description">{description}</p> : null}
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

      {showSearch ? (
        <section className="section-card admin-search-card">
          <div className="admin-search-toolbar">
            <label className="admin-search-control">
              <Search className="h-5 w-5 shrink-0 text-[#616161]" />
              <input
                className="admin-search-input"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchChange?.(event.target.value)}
              />
            </label>
            {showFilter ? (
              <button className="polaris-button polaris-button-secondary w-fit">
                <Filter className="h-4 w-4" />
                Filter
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

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
                {rowActions ? <th className="admin-actions-heading">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={getRowKey(row)} className={getRowClassName?.(row)}>
                  {columns.map((column) => (
                    <td key={column.header} className={column.className}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions ? <td className="admin-actions-cell">{rowActions(row)}</td> : null}
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
        {tableFooter ? <div className="table-card-footer">{tableFooter}</div> : null}
      </section>
    </div>
  )
}
