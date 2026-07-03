import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Box, MoreHorizontal, Package, Pencil, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminProduct, listAdminProducts, saveAdminBundleLineItem, saveAdminProduct } from '../lib/admin.functions'
import { formatMoney, titleCase } from '../lib/utils'

export const Route = createFileRoute('/admin/products')({
  loader: () => listAdminProducts(),
  component: AdminProductsPage,
})

type ProductRow = {
  id: string
  name: string
  description: string | null
  sku_code: string | null
  manufacturer_barcode: string | null
  category_id: string | null
  product_type: string | null
  shortform: string | null
  supplier_name: string | null
  price_retail: number | string
  price_distributor: number | string
  weight_g: number | null
  length_cm: number | string | null
  height_cm: number | string | null
  status_ready: boolean
  credit_required: boolean
  custom_bundle_price: number | string | null
  hide_retail: boolean
  hide_distributor: boolean
  created_at: Date | string
  category_name: string | null
  image_url: string | null
}
type ProductFormMode = 'single' | 'bundle'
type ProductTab = 'all' | 'product' | 'gift' | 'merchandise' | 'bundle'

const productTabs: Array<{ id: ProductTab; label: string }> = [
  { id: 'all', label: 'All Products' },
  { id: 'product', label: 'Product' },
  { id: 'gift', label: 'Gift' },
  { id: 'merchandise', label: 'Merchandise' },
  { id: 'bundle', label: 'Bundle' },
]

const pageSizeOptions = [10, 20, 50, 100, 500]

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function numericString(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function productKind(row: ProductRow): Exclude<ProductTab, 'all'> {
  const text = `${row.category_name ?? ''} ${row.product_type ?? ''} ${row.name ?? ''}`.toLowerCase()
  if (text.includes('bundle')) return 'bundle'
  if (text.includes('gift')) return 'gift'
  if (text.includes('merchandise')) return 'merchandise'
  return 'product'
}

function formatDate(value: unknown) {
  if (!value) return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function findCategoryId(categoryOptions: Array<{ id: string; name: string }>, name: string) {
  return categoryOptions.find((category) => category.name.toLowerCase() === name.toLowerCase())?.id ?? ''
}

function AdminProductsPage() {
  const router = useRouter()
  const { rows, categoryOptions } = Route.useLoaderData()
  const saveProduct = useServerFn(saveAdminProduct)
  const saveBundleLineItem = useServerFn(saveAdminBundleLineItem)
  const deleteProduct = useServerFn(deleteAdminProduct)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [editorMode, setEditorMode] = useState<ProductFormMode>('single')
  const [editorOpen, setEditorOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProductRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<Array<string>>([])
  const [activeTab, setActiveTab] = useState<ProductTab>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const normalizedSearch = search.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (activeTab !== 'all' && productKind(row) !== activeTab) return false
      if (!normalizedSearch) return true

      const haystack = [
        row.name,
        row.sku_code,
        row.product_type,
        row.category_name,
        row.supplier_name,
        row.price_retail,
        row.price_distributor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [activeTab, normalizedSearch, rows])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStartIndex = (currentPage - 1) * pageSize
  const paginatedRows = filteredRows.slice(pageStartIndex, pageStartIndex + pageSize)
  const pageStart = filteredRows.length === 0 ? 0 : pageStartIndex + 1
  const pageEnd = Math.min(pageStartIndex + pageSize, filteredRows.length)
  const visibleIds = paginatedRows.map((row) => row.id)
  const selectedVisibleIds = selectedIds.filter((id) => visibleIds.includes(id))
  const pendingDeleteName = String(pendingDelete?.name ?? 'this product')

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => rows.some((row) => row.id === id)))
  }, [rows])

  useEffect(() => {
    setPage(1)
  }, [activeTab, normalizedSearch, pageSize])

  function openEditor(mode: ProductFormMode, row: ProductRow | null) {
    setMessage(null)
    setEditing(row)
    setEditorMode(row ? (productKind(row) === 'bundle' ? 'bundle' : 'single') : mode)
    setEditorOpen(true)
    setChooserOpen(false)
  }

  async function submitProduct(values: ProductFormValues, bundleItems: Array<BundleItem>) {
    setBusy(true)
    try {
      const fallbackCategoryId = editorMode === 'bundle' ? findCategoryId(categoryOptions, 'Bundle') : findCategoryId(categoryOptions, values.categoryLabel)
      const savedProduct = await saveProduct({
        data: {
          id: editing?.id,
          name: values.name,
          skuCode: values.skuCode,
          manufacturerBarcode: values.manufacturerBarcode,
          categoryId: values.categoryId || fallbackCategoryId,
          description: values.description,
          productType: values.productType,
          shortform: values.shortform,
          supplierName: values.supplierName,
          priceRetail: Number(values.priceRetail || 0),
          priceDistributor: Number(values.priceDistributor || 0),
          weightG: values.weightG === '' ? null : Number(values.weightG || 0),
          lengthCm: values.lengthCm === '' ? null : Number(values.lengthCm || 0),
          heightCm: values.heightCm === '' ? null : Number(values.heightCm || 0),
          reorderLevel: null,
          statusReady: values.statusReady,
          creditRequired: values.creditRequired,
          creditValue: null,
          customBundlePrice: editorMode === 'bundle' ? Number(values.finalRetailPrice || 0) : null,
          hideRetail: values.hideRetail,
          hideDistributor: values.hideDistributor,
        },
      })
      if (editorMode === 'bundle' && bundleItems.length > 0) {
        await Promise.all(bundleItems.map((item) => saveBundleLineItem({
          data: {
            bundleProductId: savedProduct.id,
            childProductId: item.product.id,
            bundleProductCode: values.skuCode,
            productCode: item.product.sku_code ?? '',
            productCategory: item.product.category_name ?? productKind(item.product),
            quantity: item.quantity,
            priceRetail: item.price,
            priceDistributor: item.price,
          },
        })))
      }
      setEditorOpen(false)
      setEditing(null)
      setMessage(editorMode === 'bundle' ? 'Bundle saved.' : 'Product saved.')
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminModulePage
      title="Products"
      description=""
      badge="Catalog"
      primaryAction="Add product"
      onPrimaryAction={() => setChooserOpen(true)}
      metrics={[]}
      rows={paginatedRows}
      columns={[
        {
          header: '',
          className: 'product-select-cell',
          cell: (row) => (
            <ShopifyCheckbox
              checked={selectedIds.includes(row.id)}
              label={`Select ${row.name}`}
              onChange={(checked) => {
                setSelectedIds((current) => checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id))
              }}
            />
          ),
        },
        {
          header: 'Product',
          cell: (row) => (
            <div className="product-list-item">
              <div className="product-list-thumbnail" aria-hidden={!row.image_url}>
                {row.image_url ? (
                  <img src={row.image_url} alt="" loading="lazy" />
                ) : (
                  <Package className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#202223]">{row.name}</p>
                <p className="mt-1 text-sm text-[#616161]">{row.sku_code || 'No SKU'} · {titleCase(row.product_type) || titleCase(productKind(row))}</p>
              </div>
            </div>
          ),
        },
        { header: 'Category', cell: (row) => row.category_name || titleCase(productKind(row)) },
        {
          header: 'Prices',
          cell: (row) => (
            <div className="text-sm">
              <p>{formatMoney(Number(row.price_retail))}</p>
            </div>
          ),
        },
        { header: 'Supplier', cell: (row) => row.supplier_name || 'Not set' },
        { header: 'Status', cell: (row) => <Badge tone={row.status_ready ? 'success' : 'warning'}>{row.status_ready ? 'Ready' : 'Draft'}</Badge> },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search products, SKU, supplier"
      searchValue={search}
      onSearchChange={setSearch}
      showSearch={false}
      showFilter={false}
      emptyMessage="No products found."
      tableFooter={(
        <div className="table-pagination">
          <div className="table-pagination-size">
            <span>Show</span>
            <select
              className="table-pagination-select"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span>per page</span>
          </div>
          <p className="table-pagination-count">
            {filteredRows.length === 0 ? 'No products' : `${pageStart}-${pageEnd} of ${filteredRows.length} products`}
          </p>
          <div className="table-pagination-actions">
            <button className="polaris-button polaris-button-secondary" type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </button>
            <span>Page {currentPage} of {pageCount}</span>
            <button className="polaris-button polaris-button-secondary" type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              Next
            </button>
          </div>
        </div>
      )}
      rowActions={(row) => (
        <div className="admin-row-actions">
          <button className="admin-row-action admin-row-action-secondary" type="button" onClick={() => openEditor('single', row)}>
            <Pencil className="h-5 w-5" />
            Edit
          </button>
          <button
            className="admin-row-action admin-row-action-critical"
            type="button"
            onClick={() => {
              setMessage(null)
              setPendingDelete(row)
            }}
          >
            <Trash2 className="h-5 w-5" />
            Delete
          </button>
        </div>
      )}
    >
      <section className="products-tabs-card">
        <div className="products-tabs-toolbar">
          <div className="products-tabs" role="tablist" aria-label="Product status filters">
            {productTabs.map((tab) => (
              <button
                key={tab.id}
                className="products-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                data-active={activeTab === tab.id ? 'true' : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label className="products-tabs-search">
            <Search className="h-5 w-5 shrink-0 text-[#616161]" />
            <input
              placeholder="Search products, SKU, supplier"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="products-bulk-row">
          <ShopifyCheckbox
            checked={visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length}
            indeterminate={selectedVisibleIds.length > 0 && selectedVisibleIds.length < visibleIds.length}
            label="Select all visible products"
            onChange={(checked) => {
              setSelectedIds((current) => {
                if (checked) return [...new Set([...current, ...visibleIds])]
                return current.filter((id) => !visibleIds.includes(id))
              })
            }}
          />
          <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : `Select products on this page (${paginatedRows.length})`}</span>
          {selectedIds.length > 0 ? (
            <button className="polaris-button polaris-button-secondary ml-auto" type="button" onClick={() => setSelectedIds([])}>
              Clear selection
            </button>
          ) : null}
        </div>
        {message ? <p className="section-muted mt-3">{message}</p> : null}
      </section>

      {chooserOpen ? (
        <ProductTypeChooser onClose={() => setChooserOpen(false)} onSelect={(mode) => openEditor(mode, null)} />
      ) : null}

      {editorOpen ? (
        <ProductEditor
          mode={editorMode}
          product={editing}
          availableProducts={rows}
          categoryOptions={categoryOptions}
          busy={busy}
          message={message}
          onCancel={() => {
            if (busy) return
            setEditorOpen(false)
            setEditing(null)
          }}
          onSubmit={submitProduct}
        />
      ) : null}

      {pendingDelete ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setPendingDelete(null)
          }}
        >
          <section className="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
            <div className="modal-header">
              <h2 id="delete-product-title" className="section-heading">Delete product?</h2>
            </div>
            <div className="modal-body">
              <p className="text-base text-[#202223]">
                Delete <span className="font-semibold">{pendingDeleteName}</span>? This action cannot be undone.
              </p>
              {message ? <p className="section-muted mt-3">{message}</p> : null}
            </div>
            <div className="modal-footer">
              <button className="polaris-button polaris-button-secondary" type="button" onClick={() => setPendingDelete(null)} disabled={busy}>
                Cancel
              </button>
              <button
                className="polaris-button polaris-button-critical"
                type="button"
                onClick={async () => {
                  setBusy(true)
                  try {
                    await deleteProduct({ data: { id: pendingDelete.id } })
                    setPendingDelete(null)
                    setMessage('Product deleted.')
                    await router.invalidate()
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Delete failed.')
                  } finally {
                    setBusy(false)
                  }
                }}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
                Delete product
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AdminModulePage>
  )
}

type ProductFormValues = {
  name: string
  shortform: string
  skuCode: string
  manufacturerBarcode: string
  categoryId: string
  categoryLabel: string
  productType: string
  supplierName: string
  skuCreationDate: string
  description: string
  remarks: string
  weightG: string
  lengthCm: string
  heightCm: string
  priceRetail: string
  priceDistributor: string
  finalRetailPrice: string
  statusReady: boolean
  creditRequired: boolean
  hideRetail: boolean
  hideDistributor: boolean
}

type BundleItem = {
  product: ProductRow
  quantity: number
  price: number
}

function getInitialProductValues(product: ProductRow | null, mode: ProductFormMode): ProductFormValues {
  const categoryLabel = mode === 'bundle' ? 'Bundle' : stringValue(product?.category_name, mode === 'single' ? 'Product' : 'Bundle')
  return {
    name: stringValue(product?.name),
    shortform: stringValue(product?.shortform),
    skuCode: stringValue(product?.sku_code),
    manufacturerBarcode: stringValue(product?.manufacturer_barcode, 'NA'),
    categoryId: stringValue(product?.category_id),
    categoryLabel,
    productType: stringValue(product?.product_type, mode === 'bundle' ? 'Bundle' : 'Physical'),
    supplierName: stringValue(product?.supplier_name, 'NA'),
    skuCreationDate: formatDate(product?.created_at),
    description: stringValue(product?.description),
    remarks: '',
    weightG: numericString(product?.weight_g),
    lengthCm: numericString(product?.length_cm),
    heightCm: numericString(product?.height_cm),
    priceRetail: numericString(product?.price_retail),
    priceDistributor: numericString(product?.price_distributor),
    finalRetailPrice: numericString(product?.custom_bundle_price ?? product?.price_retail),
    statusReady: booleanValue(product?.status_ready, true),
    creditRequired: booleanValue(product?.credit_required),
    hideRetail: booleanValue(product?.hide_retail),
    hideDistributor: booleanValue(product?.hide_distributor),
  }
}

function ProductEditor({
  mode,
  product,
  availableProducts,
  categoryOptions,
  busy,
  message,
  onCancel,
  onSubmit,
}: {
  mode: ProductFormMode
  product: ProductRow | null
  availableProducts: Array<ProductRow>
  categoryOptions: Array<{ id: string; name: string }>
  busy: boolean
  message: string | null
  onCancel: () => void
  onSubmit: (values: ProductFormValues, bundleItems: Array<BundleItem>) => Promise<void>
}) {
  const [values, setValues] = useState(() => getInitialProductValues(product, mode))
  const [bundleItems, setBundleItems] = useState<Array<BundleItem>>([])
  const isBundle = mode === 'bundle'
  const isEditing = Boolean(product)
  const bundleTotalPrice = bundleItems.reduce((total, item) => total + item.quantity * item.price, 0)
  const editorTitle = isEditing
    ? (isBundle ? 'Edit bundle product' : 'Edit single product')
    : (isBundle ? 'Create new bundle product' : 'Create new single product')

  useEffect(() => {
    setValues(getInitialProductValues(product, mode))
    setBundleItems([])
  }, [mode, product])

  useEffect(() => {
    if (!isBundle || bundleItems.length === 0) return
    const nextPrice = bundleTotalPrice.toFixed(2)
    setValues((current) => ({
      ...current,
      finalRetailPrice: nextPrice,
      priceRetail: nextPrice,
      priceDistributor: nextPrice,
    }))
  }, [bundleItems.length, bundleTotalPrice, isBundle])

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit(values, bundleItems)
  }

  return (
    <div
      className="modal-backdrop product-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <section className="product-editor-panel" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
        <form onSubmit={submit}>
          <div className="product-form-card">
            <div className="product-form-title-row">
              <h2 id="product-editor-title">{editorTitle}</h2>
            </div>
            <h3>Product Details</h3>
            {isBundle ? (
              <BundleDetails values={values} update={update} />
            ) : (
              <SingleProductDetails values={values} categoryOptions={categoryOptions} update={update} />
            )}

            {isBundle ? (
              <BundleBuilder
                values={values}
                update={update}
                currentProductId={product?.id}
                availableProducts={availableProducts}
                bundleItems={bundleItems}
                onBundleItemsChange={setBundleItems}
              />
            ) : <SingleProductPrice values={values} update={update} />}
            <ProductOptions values={values} update={update} />

            {message ? <p className="section-muted">{message}</p> : null}
            <div className="product-editor-footer">
              <button className="polaris-button polaris-button-primary" type="submit" disabled={busy}>
                {isEditing ? (isBundle ? 'Save bundle product' : 'Save single product') : (isBundle ? 'Create bundle product' : 'Create single product')}
              </button>
              <button className="polaris-button polaris-button-secondary" type="button" onClick={onCancel} disabled={busy}>
                Discard
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

function SingleProductDetails({
  values,
  categoryOptions,
  update,
}: {
  values: ProductFormValues
  categoryOptions: Array<{ id: string; name: string }>
  update: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void
}) {
  return (
    <>
      <TextField label="Product Name" required value={values.name} onChange={(value) => update('name', value)} />
      <TextField label="Product Shortform (15 characters only, no space)" required placeholder="eg. Vegan10s" value={values.shortform} onChange={(value) => update('shortform', value.replace(/\s/g, '').slice(0, 15))} />
      <div className="product-form-grid">
        <TextField label="SKU Code" required value={values.skuCode} onChange={(value) => update('skuCode', value)} />
        <TextField label="Manufacturer Barcode" required value={values.manufacturerBarcode} onChange={(value) => update('manufacturerBarcode', value)} />
      </div>
      <div className="product-form-grid">
        <SelectField
          label="Category"
          required
          value={values.categoryId}
          onChange={(value) => {
            const label = categoryOptions.find((category) => category.id === value)?.name ?? ''
            update('categoryId', value)
            update('categoryLabel', label)
          }}
          options={categoryOptions.map((category) => ({ value: category.id, label: category.name }))}
        />
        <SelectField
          label="Product Type"
          required
          value={values.productType}
          onChange={(value) => update('productType', value)}
          options={[
            { value: 'Physical', label: 'Physical' },
            { value: 'Virtual', label: 'Virtual' },
            { value: 'Bundle', label: 'Bundle' },
          ]}
        />
      </div>
      <div className="product-form-grid">
        <TextField label="Supplier Name" required value={values.supplierName} onChange={(value) => update('supplierName', value)} />
        <TextField label="SKU Creation Date" value={values.skuCreationDate} onChange={(value) => update('skuCreationDate', value)} />
      </div>
      <RichTextField label="Description" required value={values.description} onChange={(value) => update('description', value)} />
      <ImageDropzone label="Product image" />
      <div className="product-form-grid">
        <TextField label="Weight (g)" required type="number" value={values.weightG} onChange={(value) => update('weightG', value)} />
        <TextField label="Length (cm)" required type="number" value={values.lengthCm} onChange={(value) => update('lengthCm', value)} />
      </div>
      <div className="product-form-grid product-form-grid-remarks">
        <TextField label="Height (cm)" required type="number" value={values.heightCm} onChange={(value) => update('heightCm', value)} />
        <TextField label="Remarks" value={values.remarks} onChange={(value) => update('remarks', value)} />
      </div>
    </>
  )
}

function BundleDetails({
  values,
  update,
}: {
  values: ProductFormValues
  update: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void
}) {
  return (
    <>
      <TextField label="Bundle Name" required value={values.name} onChange={(value) => update('name', value)} />
      <TextField label="SKU Code" required value={values.skuCode} onChange={(value) => update('skuCode', value)} />
      <RichTextField label="Description" required value={values.description} onChange={(value) => update('description', value)} />
      <TextField label="Remarks" value={values.remarks} onChange={(value) => update('remarks', value)} />
      <ImageDropzone label="Product image" />
    </>
  )
}

function SingleProductPrice({
  values,
  update,
}: {
  values: ProductFormValues
  update: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void
}) {
  return (
    <section className="product-form-section">
      <h3>Set Product Price</h3>
      <TextField label="Retail price" required type="number" value={values.priceRetail} onChange={(value) => {
        update('priceRetail', value)
        update('priceDistributor', value)
      }} />
    </section>
  )
}

function ProductOptions({
  values,
  update,
}: {
  values: ProductFormValues
  update: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void
}) {
  return (
    <section className="product-form-section">
      <h3>Set Product Visibility</h3>
      <SwitchRow label="Ready" checked={values.statusReady} onChange={(checked) => update('statusReady', checked)} />
      <SwitchRow label="Credits required" checked={values.creditRequired} onChange={(checked) => update('creditRequired', checked)} />
      <SwitchRow label="Hide product from distributor listing" checked={values.hideDistributor} onChange={(checked) => update('hideDistributor', checked)} />
      <SwitchRow label="Hide product from retail listing" checked={values.hideRetail} onChange={(checked) => update('hideRetail', checked)} />
    </section>
  )
}

function BundleBuilder({
  values,
  update,
  currentProductId,
  availableProducts,
  bundleItems,
  onBundleItemsChange,
}: {
  values: ProductFormValues
  update: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void
  currentProductId?: string
  availableProducts: Array<ProductRow>
  bundleItems: Array<BundleItem>
  onBundleItemsChange: (items: Array<BundleItem>) => void
}) {
  const [productSearch, setProductSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const normalizedSearch = productSearch.trim().toLowerCase()
  const selectedProductIds = new Set(bundleItems.map((item) => item.product.id))
  const searchableProducts = availableProducts
    .filter((row) => row.id !== currentProductId && productKind(row) !== 'bundle' && !selectedProductIds.has(row.id))
    .filter((row) => {
      if (!normalizedSearch) return true
      return [row.name, row.sku_code, row.category_name, row.product_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
    .slice(0, 8)
  const totalQuantity = bundleItems.reduce((total, item) => total + item.quantity, 0)
  const totalWeightKg = bundleItems.reduce((total, item) => total + ((item.product.weight_g ?? 0) * item.quantity) / 1000, 0)
  const totalPrice = bundleItems.reduce((total, item) => total + item.quantity * item.price, 0)

  function addProduct(row: ProductRow) {
    onBundleItemsChange([...bundleItems, { product: row, quantity: 1, price: Number(row.price_retail || 0) }])
    setProductSearch('')
    setShowResults(false)
  }

  function updateItem(productId: string, next: Partial<Pick<BundleItem, 'quantity' | 'price'>>) {
    onBundleItemsChange(bundleItems.map((item) => item.product.id === productId ? { ...item, ...next } : item))
  }

  return (
    <section className="product-form-section">
      <h3>Search Products</h3>
      <div className="bundle-search-card">
        <div className="bundle-search-row">
          <label className="bundle-search-input">
            <Search className="h-4 w-4 text-[#616161]" />
            <input
              value={productSearch}
              onChange={(event) => {
                setProductSearch(event.target.value)
                setShowResults(true)
              }}
              placeholder="Search products by name or SKU"
            />
          </label>
          <button className="polaris-button polaris-button-primary" type="button" onClick={() => setShowResults((current) => !current)}>Browse</button>
        </div>
        {showResults ? (
          <div className="bundle-search-results">
            {searchableProducts.map((row) => (
              <button key={row.id} className="bundle-search-result" type="button" onClick={() => addProduct(row)}>
                <span className="bundle-product-thumb">IMG</span>
                <span>
                  <strong>{row.name}</strong>
                  <small>{row.sku_code || 'No SKU'} · {formatMoney(Number(row.price_retail || 0))}</small>
                </span>
                <span>Add</span>
              </button>
            ))}
            {searchableProducts.length === 0 ? <p className="bundle-empty">No matching products found.</p> : null}
          </div>
        ) : null}
        <div className="bundle-table">
          <span>Image</span>
          <span>Description</span>
          <span>Quantity</span>
          <span>Price (RM)</span>
          <MoreHorizontal className="h-4 w-4 justify-self-end" />
          {bundleItems.map((item) => (
            <div key={item.product.id} className="bundle-table-row">
              <span className="bundle-product-thumb">IMG</span>
              <span className="bundle-product-description">
                <strong>{item.product.name}</strong>
                <small>{item.product.sku_code || 'No SKU'}</small>
              </span>
              <input
                className="form-input"
                type="number"
                min={1}
                step={1}
                value={String(item.quantity)}
                onChange={(event) => updateItem(item.product.id, { quantity: Math.max(1, Number(event.target.value || 1)) })}
              />
              <input
                className="form-input"
                type="number"
                min={0}
                step="0.01"
                value={String(item.price)}
                onChange={(event) => updateItem(item.product.id, { price: Math.max(0, Number(event.target.value || 0)) })}
              />
              <button
                className="bundle-remove-button"
                type="button"
                aria-label={`Remove ${item.product.name}`}
                onClick={() => onBundleItemsChange(bundleItems.filter((bundleItem) => bundleItem.product.id !== item.product.id))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {bundleItems.length === 0 ? <p className="bundle-empty">No product selected...</p> : null}
        </div>
      </div>
      <div className="bundle-final-price">
        <span>Final Retail Price</span>
        <label className="bundle-custom-price">
          Custom price
          <span className="switch-control" aria-checked="true" />
        </label>
      </div>
      <TextField label="" type="number" placeholder="RM 0" value={values.finalRetailPrice} onChange={(value) => {
        update('finalRetailPrice', value)
        update('priceRetail', value)
        update('priceDistributor', value)
      }} />
      <div className="bundle-summary">
        <h3>Bundle Summary</h3>
        <SummaryRow label="Total Item Quantity" value={totalQuantity > 0 ? `${totalQuantity} item` : 'No item'} />
        <SummaryRow label="Total Bundle Weight" value={`${totalWeightKg.toFixed(2)} kg`} />
        <SummaryRow label="Total Bundle Retail Price" value={`RM ${totalPrice.toFixed(2)}`} strong />
      </div>
    </section>
  )
}

function ProductTypeChooser({ onClose, onSelect }: { onClose: () => void; onSelect: (mode: ProductFormMode) => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="modal-panel max-w-xl" role="dialog" aria-modal="true" aria-labelledby="choose-product-title">
        <div className="modal-header">
          <div className="flex items-start justify-between gap-4">
            <h2 id="choose-product-title" className="section-heading">Add product</h2>
            <button className="polaris-button polaris-button-secondary" type="button" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="modal-body product-choice-grid">
          <ProductChoice icon={<Package className="h-5 w-5" />} title="Single product" description="Create a product, gift, or merchandise SKU." onClick={() => onSelect('single')} />
          <ProductChoice icon={<Box className="h-5 w-5" />} title="Bundle product" description="Create a parent SKU with bundle pricing and product selection." onClick={() => onSelect('bundle')} />
        </div>
      </section>
    </div>
  )
}

function ProductChoice({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button className="product-choice" type="button" onClick={onClick}>
      <span className="product-choice-icon">{icon}</span>
      <span className="font-semibold text-[#202223]">{title}</span>
      <span className="section-muted">{description}</span>
    </button>
  )
}

function TextField({ label, required, type = 'text', placeholder, value, onChange }: { label: string; required?: boolean; type?: string; placeholder?: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="product-field">
      {label ? <span>{label}{required ? <b>*</b> : null}</span> : null}
      <input className="form-input" type={type} value={value} placeholder={placeholder} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SelectField({ label, required, value, options, onChange }: { label: string; required?: boolean; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="product-field">
      <span>{label}{required ? <b>*</b> : null}</span>
      <select className="form-select" value={value} required={required} onChange={(event) => onChange(event.target.value)}>
        <option value=""></option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function RichTextField({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (value: string) => void }) {
  return (
    <label className="product-field">
      <span>{label}{required ? <b>*</b> : null}</span>
      <div className="rich-text-shell">
        <div className="rich-text-toolbar" aria-hidden="true">
          <span>Sans Serif</span>
          <b>B</b>
          <i>I</i>
          <u>U</u>
          <s>S</s>
          <span>A</span>
          <b>H1</b>
          <b>H2</b>
          <b>H3</b>
          <b>H4</b>
          <span>1.</span>
          <span>List</span>
          <span>Align</span>
          <span>Link</span>
        </div>
        <textarea className="rich-text-area" value={value} required={required} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  )
}

function ImageDropzone({ label }: { label: string }) {
  return (
    <div className="product-field">
      <span>{label}<b>*</b></span>
      <button className="product-image-dropzone" type="button">Click to upload an image</button>
    </div>
  )
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="switch-row">
      <input className="sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-control" aria-checked={checked} />
      <span>{label}</span>
    </label>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'bundle-summary-row font-bold' : 'bundle-summary-row'}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function ShopifyCheckbox({ checked, indeterminate, label, onChange }: { checked: boolean; indeterminate?: boolean; label: string; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])

  return (
    <span className="shopify-checkbox-label">
      <input ref={ref} className="shopify-checkbox-input" type="checkbox" checked={checked} aria-label={label} onChange={(event) => onChange(event.target.checked)} />
      <span className="shopify-checkbox-box" aria-hidden="true" />
    </span>
  )
}
