import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { deleteAdminWarehousePlatform, listAdminWarehouses, saveAdminWarehousePlatform } from '../lib/admin.functions'
import { formatDateTime } from '../lib/utils'

export const Route = createFileRoute('/admin/warehouses')({
  loader: () => listAdminWarehouses(),
  component: AdminWarehousesPage,
})

function AdminWarehousesPage() {
  const router = useRouter()
  const { rows, stats } = Route.useLoaderData()
  const saveWarehouse = useServerFn(saveAdminWarehousePlatform)
  const deleteWarehouse = useServerFn(deleteAdminWarehousePlatform)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const values = {
    id: editing?.id,
    name: editing?.name ?? '',
    orderPrefix: editing?.order_prefix ?? '',
    stockRaw: editing?.stock_raw ?? '',
    stockMovementRaw: editing?.stock_movement_raw ?? '',
  }

  return (
    <AdminModulePage
      title="Warehouses"
      description="Manage warehouse platforms, user relations, stock locations, and default fulfillment ownership."
      badge="Stock"
      primaryAction="New warehouse"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Warehouses', value: stats.warehousePlatforms, detail: 'Warehouse platform rows' },
        { label: 'User relations', value: stats.userRelations, detail: 'Manager-to-warehouse links' },
        { label: 'Default links', value: stats.defaultRelations, detail: 'Default warehouse ownership' },
        { label: 'Stock rows', value: stats.warehouseStock, detail: 'Warehouse product quantities' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Warehouse',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.name}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.order_prefix || 'No order prefix'}</p>
            </div>
          ),
        },
        { header: 'Stock source', cell: (row) => row.stock_raw || 'No stock reference' },
        { header: 'Movement source', cell: (row) => row.stock_movement_raw || 'No movement reference' },
        { header: 'Updated', cell: (row) => formatDateTime(row.updated_at) || 'Not available' },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search warehouses or prefixes"
      emptyMessage="No warehouses found."
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
                await deleteWarehouse({ data: { id: row.id } })
                setMessage('Warehouse deleted.')
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
        title={editing ? 'Edit warehouse' : 'Create warehouse'}
        description="Manages warehouse platform records used by fulfillment and stock ownership."
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'orderPrefix', label: 'Order prefix' },
          { name: 'stockRaw', label: 'Stock source', type: 'textarea' },
          { name: 'stockMovementRaw', label: 'Movement source', type: 'textarea' },
        ]}
        initialValues={values}
        submitLabel={editing ? 'Save warehouse' : 'Create warehouse'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (formValues) => {
          setBusy(true)
          try {
            await saveWarehouse({
              data: {
                id: typeof values.id === 'string' ? values.id : undefined,
                name: String(formValues.name ?? ''),
                orderPrefix: String(formValues.orderPrefix ?? ''),
                stockRaw: String(formValues.stockRaw ?? ''),
                stockMovementRaw: String(formValues.stockMovementRaw ?? ''),
              },
            })
            setEditing(null)
            setMessage('Warehouse saved.')
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
