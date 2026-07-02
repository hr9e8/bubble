import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminStockBalance, listAdminStocks, saveAdminStockBalance } from '../lib/admin.functions'
import { formatNumber } from '../lib/utils'

export const Route = createFileRoute('/admin/stocks')({
  loader: () => listAdminStocks(),
  component: AdminStocksPage,
})

function AdminStocksPage() {
  const router = useRouter()
  const { rows, stats, productOptions, warehouseOptions, userOptions } = Route.useLoaderData()
  const saveBalance = useServerFn(saveAdminStockBalance)
  const deleteBalance = useServerFn(deleteAdminStockBalance)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const values = {
    id: editing?.id,
    productId: editing?.product_id ?? '',
    ownerUserId: editing?.owner_user_id ?? '',
    warehousePlatformId: editing?.warehouse_platform_id ?? '',
    availableQuantity: editing?.available_quantity ?? 0,
    committedQuantity: editing?.committed_quantity ?? 0,
    reorderLevel: editing?.reorder_level ?? '',
  }
  const productSelectOptions = productOptions.map((product) => ({
    value: product.id,
    label: `${product.name}${product.sku_code ? ` (${product.sku_code})` : ''}`,
  }))

  return (
    <AdminModulePage
      title="Admin stocks"
      description="Assign stock using append-only stock movements; balances are derived and destructive deletes are blocked."
      badge="Ledger"
      primaryAction="Assign stock"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Lots', value: stats.lots, detail: 'Imported stock lots' },
        { label: 'Movements', value: stats.movements, detail: 'Append-only ledger entries' },
        { label: 'Balances', value: stats.balances, detail: 'Current balance rows' },
        { label: 'Warehouse stock', value: stats.warehouseStock, detail: 'Legacy warehouse quantities' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Product',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.product_name || 'Unknown product'}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.sku_code || 'No SKU'}</p>
            </div>
          ),
        },
        { header: 'Owner', cell: (row) => row.owner_user_id || row.warehouse_name || 'Unassigned' },
        { header: 'Available', cell: (row) => formatNumber(row.available_quantity) },
        { header: 'Committed', cell: (row) => formatNumber(row.committed_quantity) },
        {
          header: 'Reorder',
          cell: (row) => row.reorder_level ? <Badge tone={row.available_quantity <= row.reorder_level ? 'warning' : 'success'}>{row.reorder_level}</Badge> : 'Not set',
        },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search stock by product, SKU, owner"
      emptyMessage="No stock balances found."
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
              if (!window.confirm('Delete this stock balance row?')) return
              setBusy(true)
              try {
                await deleteBalance({ data: { id: row.id } })
                setMessage('Stock balance deleted.')
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
        title={editing ? 'Edit stock balance' : 'Create stock balance'}
        description="Maintains the administrative stock balance table. Operational stock movement screens still create append-only movement rows."
        fields={[
          { name: 'productId', label: 'Product', type: 'select', required: true, options: productSelectOptions },
          { name: 'ownerUserId', label: 'Owner user', type: 'select', options: userOptions.map((user) => ({ value: user.id, label: user.email ? `${user.name} (${user.email})` : user.name })) },
          { name: 'warehousePlatformId', label: 'Warehouse', type: 'select', options: warehouseOptions.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })) },
          { name: 'availableQuantity', label: 'Available', type: 'number', step: '1' },
          { name: 'committedQuantity', label: 'Committed', type: 'number', step: '1', min: 0 },
          { name: 'reorderLevel', label: 'Reorder level', type: 'number', step: '1', min: 0 },
        ]}
        initialValues={values}
        submitLabel={editing ? 'Save balance' : 'Create balance'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (formValues) => {
          setBusy(true)
          try {
            await saveBalance({
              data: {
                id: typeof values.id === 'string' ? values.id : undefined,
                productId: String(formValues.productId ?? ''),
                ownerUserId: String(formValues.ownerUserId ?? ''),
                warehousePlatformId: String(formValues.warehousePlatformId ?? ''),
                availableQuantity: Number(formValues.availableQuantity || 0),
                committedQuantity: Number(formValues.committedQuantity || 0),
                reorderLevel: formValues.reorderLevel === '' ? null : Number(formValues.reorderLevel || 0),
              },
            })
            setEditing(null)
            setMessage('Stock balance saved.')
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
