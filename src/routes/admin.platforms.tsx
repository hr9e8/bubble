import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminSalesPlatform, listAdminPlatforms, saveAdminSalesPlatform } from '../lib/admin.functions'
import { formatMoney, titleCase } from '../lib/utils'

export const Route = createFileRoute('/admin/platforms')({
  loader: () => listAdminPlatforms(),
  component: AdminPlatformsPage,
})

function AdminPlatformsPage() {
  const router = useRouter()
  const { rows } = Route.useLoaderData()
  const savePlatform = useServerFn(saveAdminSalesPlatform)
  const deletePlatform = useServerFn(deleteAdminSalesPlatform)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = normalizedSearch
    ? rows.filter((row) => {
        const haystack = [
          row.name,
          row.order_prefix,
          row.platform_category,
          row.url,
          row.finance_approval_active ? 'enabled' : 'disabled',
          row.order_min_limit_approval,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalizedSearch)
      })
    : rows
  const values = {
    id: editing?.id,
    name: editing?.name ?? '',
    orderPrefix: editing?.order_prefix ?? '',
    platformCategory: editing?.platform_category ?? '',
    financeApprovalActive: editing?.finance_approval_active ?? false,
    orderMinLimitApproval: editing?.order_min_limit_approval ?? '',
    url: editing?.url ?? '',
  }

  return (
    <AdminModulePage
      title="Platforms"
      description="Configure sales platforms, warehouse platforms, website owners, categories, options, and order prefixes."
      badge="Operations"
      primaryAction="New platform"
      onPrimaryAction={() => {
        setEditing(null)
        setEditorOpen(true)
      }}
      metrics={[]}
      rows={filteredRows}
      columns={[
        {
          header: 'Platform',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.name}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.url || 'No URL'}</p>
            </div>
          ),
        },
        { header: 'Prefix', cell: (row) => row.order_prefix || 'Not set' },
        { header: 'Category', cell: (row) => titleCase(row.platform_category) || 'Uncategorized' },
        { header: 'Approval', cell: (row) => <Badge tone={row.finance_approval_active ? 'warning' : 'neutral'}>{row.finance_approval_active ? 'Enabled' : 'Disabled'}</Badge> },
        { header: 'Min approval', cell: (row) => row.order_min_limit_approval ? formatMoney(Number(row.order_min_limit_approval)) : 'No threshold' },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search platforms, prefixes, URLs"
      searchValue={search}
      onSearchChange={setSearch}
      showFilter={false}
      emptyMessage="No sales platforms found."
      rowActions={(row) => (
        <div className="admin-row-actions">
          <button
            className="admin-row-action admin-row-action-secondary"
            type="button"
            onClick={() => {
              setEditing(row)
              setEditorOpen(true)
            }}
          >
            <Pencil className="h-5 w-5" />
            Edit
          </button>
          <button
            className="admin-row-action admin-row-action-critical"
            type="button"
            onClick={async () => {
              if (!window.confirm(`Delete ${row.name}?`)) return
              setBusy(true)
              try {
                await deletePlatform({ data: { id: row.id } })
                setMessage('Platform deleted.')
                await router.invalidate()
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Delete failed.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Trash2 className="h-5 w-5" />
            Delete
          </button>
        </div>
      )}
    >
      {editorOpen ? (
        <AdminCrudPanel
          presentation="modal"
          title={editing ? 'Edit platform' : 'Create sales platform'}
          description="Updates sales channel setup used by orders and finance approval routing."
          fields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'orderPrefix', label: 'Order prefix' },
            { name: 'platformCategory', label: 'Category' },
            { name: 'url', label: 'URL' },
            { name: 'orderMinLimitApproval', label: 'Approval minimum', type: 'number', step: '0.01', min: 0 },
            { name: 'financeApprovalActive', label: 'Finance approval active', type: 'checkbox' },
          ]}
          initialValues={values}
          submitLabel={editing ? 'Save platform' : 'Create platform'}
          busy={busy}
          message={message}
          onCancel={() => {
            setEditorOpen(false)
            setEditing(null)
          }}
          onSubmit={async (formValues) => {
            setBusy(true)
            try {
              await savePlatform({
                data: {
                  id: typeof values.id === 'string' ? values.id : undefined,
                  name: String(formValues.name ?? ''),
                  orderPrefix: String(formValues.orderPrefix ?? ''),
                  platformCategory: String(formValues.platformCategory ?? ''),
                  url: String(formValues.url ?? ''),
                  orderMinLimitApproval: formValues.orderMinLimitApproval === '' ? null : Number(formValues.orderMinLimitApproval || 0),
                  financeApprovalActive: Boolean(formValues.financeApprovalActive),
                },
              })
              setEditorOpen(false)
              setEditing(null)
              setMessage('Platform saved.')
              await router.invalidate()
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Save failed.')
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : null}
    </AdminModulePage>
  )
}
