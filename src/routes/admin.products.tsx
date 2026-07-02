import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminProduct, listAdminProducts, saveAdminProduct } from '../lib/admin.functions'
import { formatMoney, titleCase } from '../lib/utils'

export const Route = createFileRoute('/admin/products')({
  loader: () => listAdminProducts(),
  component: AdminProductsPage,
})

function AdminProductsPage() {
  const router = useRouter()
  const { rows, stats, categoryOptions } = Route.useLoaderData()
  const saveProduct = useServerFn(saveAdminProduct)
  const deleteProduct = useServerFn(deleteAdminProduct)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const productValues = {
    id: editing?.id,
    name: editing?.name ?? '',
    skuCode: editing?.sku_code ?? '',
    categoryId: editing?.category_id ?? '',
    productType: editing?.product_type ?? '',
    supplierName: editing?.supplier_name ?? '',
    priceRetail: editing?.price_retail ?? 0,
    priceDistributor: editing?.price_distributor ?? 0,
    reorderLevel: editing?.reorder_level ?? '',
    statusReady: editing?.status_ready ?? true,
    creditRequired: editing?.credit_required ?? false,
    creditValue: editing?.credit_value ?? '',
    customBundlePrice: editing?.custom_bundle_price ?? '',
    hideRetail: editing?.hide_retail ?? false,
    hideDistributor: editing?.hide_distributor ?? false,
  }

  return (
    <AdminModulePage
      title="Products"
      description="Manage product parity fields, categories, images, supplier data, dimensions, product type, visibility, and reorder levels."
      badge="Catalog"
      primaryAction="New product"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Products', value: stats.products, detail: 'Catalog records' },
        { label: 'Categories', value: stats.categories, detail: 'Product groups' },
        { label: 'Credit SKUs', value: stats.creditProducts, detail: 'Require product credits' },
        { label: 'Hidden retail', value: stats.hiddenRetail, detail: 'Retail visibility disabled' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Product',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.name}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.sku_code || 'No SKU'} · {titleCase(row.product_type) || 'No type'}</p>
            </div>
          ),
        },
        { header: 'Category', cell: (row) => row.category_name || 'Uncategorized' },
        {
          header: 'Prices',
          cell: (row) => (
            <div className="text-sm">
              <p>{formatMoney(Number(row.price_retail))} retail</p>
              <p className="mt-1 text-[#616161]">{formatMoney(Number(row.price_distributor))} distributor</p>
            </div>
          ),
        },
        { header: 'Supplier', cell: (row) => row.supplier_name || 'Not set' },
        { header: 'Status', cell: (row) => <Badge tone={row.status_ready ? 'success' : 'warning'}>{row.status_ready ? 'Ready' : 'Draft'}</Badge> },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search products, SKU, supplier"
      emptyMessage="No products found."
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
                await deleteProduct({ data: { id: row.id } })
                setMessage('Product deleted.')
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
        title={editing ? 'Edit product' : 'Create product'}
        description="Save catalog fields directly to the products table."
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'skuCode', label: 'SKU' },
          { name: 'categoryId', label: 'Category', type: 'select', options: categoryOptions.map((category) => ({ value: category.id, label: category.name })) },
          { name: 'productType', label: 'Type' },
          { name: 'supplierName', label: 'Supplier' },
          { name: 'priceRetail', label: 'Retail price', type: 'number', step: '0.01', min: 0 },
          { name: 'priceDistributor', label: 'Distributor price', type: 'number', step: '0.01', min: 0 },
          { name: 'reorderLevel', label: 'Reorder level', type: 'number', step: '1', min: 0 },
          { name: 'creditValue', label: 'Credit value', type: 'number', step: '0.0001', min: 0 },
          { name: 'customBundlePrice', label: 'Bundle price', type: 'number', step: '0.01', min: 0 },
          { name: 'statusReady', label: 'Ready', type: 'checkbox' },
          { name: 'creditRequired', label: 'Credits required', type: 'checkbox' },
          { name: 'hideRetail', label: 'Hide retail', type: 'checkbox' },
          { name: 'hideDistributor', label: 'Hide distributor', type: 'checkbox' },
        ]}
        initialValues={productValues}
        submitLabel={editing ? 'Save product' : 'Create product'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (values) => {
          setBusy(true)
          try {
            await saveProduct({
              data: {
                id: typeof productValues.id === 'string' ? productValues.id : undefined,
                name: String(values.name ?? ''),
                skuCode: String(values.skuCode ?? ''),
                categoryId: String(values.categoryId ?? ''),
                productType: String(values.productType ?? ''),
                supplierName: String(values.supplierName ?? ''),
                priceRetail: Number(values.priceRetail || 0),
                priceDistributor: Number(values.priceDistributor || 0),
                reorderLevel: values.reorderLevel === '' ? null : Number(values.reorderLevel || 0),
                statusReady: Boolean(values.statusReady),
                creditRequired: Boolean(values.creditRequired),
                creditValue: values.creditValue === '' ? null : Number(values.creditValue || 0),
                customBundlePrice: values.customBundlePrice === '' ? null : Number(values.customBundlePrice || 0),
                hideRetail: Boolean(values.hideRetail),
                hideDistributor: Boolean(values.hideDistributor),
              },
            })
            setEditing(null)
            setMessage('Product saved.')
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
