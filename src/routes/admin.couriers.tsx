import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { deleteAdminCourier, listAdminCouriers, saveAdminCourier } from '../lib/admin.functions'
import { formatDateTime } from '../lib/utils'

export const Route = createFileRoute('/admin/couriers')({
  loader: () => listAdminCouriers(),
  component: AdminCouriersPage,
})

function AdminCouriersPage() {
  const router = useRouter()
  const { rows, stats } = Route.useLoaderData()
  const saveCourier = useServerFn(saveAdminCourier)
  const deleteCourier = useServerFn(deleteAdminCourier)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const values = {
    id: editing?.id,
    name: editing?.name ?? '',
    trackingUrl: editing?.tracking_url ?? '',
    legacySlug: editing?.legacy_slug ?? '',
  }

  return (
    <AdminModulePage
      title="Couriers"
      description="Manage shipping couriers, courier accounts, tracking URL templates, and AWB label references."
      badge="Warehouse"
      primaryAction="New courier"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Couriers', value: stats.couriers, detail: 'Courier directory rows' },
        { label: 'Accounts', value: stats.accounts, detail: 'Sold-to and pickup accounts' },
        { label: 'Manifests', value: stats.manifests, detail: 'Order manifest records' },
        { label: 'Warehouse events', value: stats.warehouseEvents, detail: 'Tracking and AWB events' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Courier',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.name}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.legacy_slug || 'No slug'}</p>
            </div>
          ),
        },
        { header: 'Tracking URL', cell: (row) => row.tracking_url || 'Not configured' },
        { header: 'Created by', cell: (row) => row.created_by || 'Unknown' },
        { header: 'Updated', cell: (row) => formatDateTime(row.updated_at) || 'Not available' },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search couriers or account IDs"
      emptyMessage="No couriers found."
      rowActions={(row) => (
        <div className="flex flex-wrap gap-2">
          <button className="polaris-button polaris-button-secondary" type="button" onClick={() => setEditing(row)}>
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            className="polaris-button polaris-button-critical"
            type="button"
            onClick={async () => {
              if (!window.confirm(`Delete ${row.name}?`)) return
              setBusy(true)
              try {
                await deleteCourier({ data: { id: row.id } })
                setMessage('Courier deleted.')
                await router.invalidate()
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Delete failed.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    >
      <AdminCrudPanel
        title={editing ? 'Edit courier' : 'Create courier'}
        description="Stores courier names, slugs, and tracking URL templates."
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'legacySlug', label: 'Slug' },
          { name: 'trackingUrl', label: 'Tracking URL' },
        ]}
        initialValues={values}
        submitLabel={editing ? 'Save courier' : 'Create courier'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (formValues) => {
          setBusy(true)
          try {
            await saveCourier({
              data: {
                id: typeof values.id === 'string' ? values.id : undefined,
                name: String(formValues.name ?? ''),
                legacySlug: String(formValues.legacySlug ?? ''),
                trackingUrl: String(formValues.trackingUrl ?? ''),
              },
            })
            setEditing(null)
            setMessage('Courier saved.')
            await router.invalidate()
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Save failed.')
          } finally {
            setBusy(false)
          }
        }}
      />
    </AdminModulePage>
  )
}
