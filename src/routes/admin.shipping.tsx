import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, CircleAlert, Pencil, Search, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AdminModulePage } from '../components/admin-module-page'
import { deleteAdminShippingZone, listAdminShipping, saveAdminShippingZone } from '../lib/admin.functions'
import { MALAYSIA_STATES } from '../lib/malaysia-states'
import { formatMoney } from '../lib/utils'

export const Route = createFileRoute('/admin/shipping')({
  loader: () => listAdminShipping(),
  component: AdminShippingPage,
})

type ShippingRateRow = ReturnType<typeof Route.useLoaderData>['rateRows'][number]
type ShippingZoneRow = ReturnType<typeof Route.useLoaderData>['rows'][number]
type ShippingToast = { tone: 'success' | 'error'; message: string }

type ShippingDisplayRow = {
  id: string
  kind: ShippingRateRow['kind'] | 'zone'
  name: string
  price: unknown
  shipping_type: string | null
  total_range: string | null
  weight_range: string | null
  weight_min_kg: unknown
  weight_max_kg: unknown
  total_min: unknown
  total_max: unknown
  shipping_zone_legacy_id: string | null
  zone_id: string | null
  zone_name: string | null
  zone_active: boolean | null
  zone_apply_all_product: boolean | null
  zone_country_legacy_id: string | null
  zone_apply_products_raw: string | null
  zone_states_raw: string | null
  zone_shipping_rate_raw: string | null
  zone_shipping_cod_rate_raw: string | null
}

function AdminShippingPage() {
  const router = useRouter()
  const { rows: zoneRows, rateRows } = Route.useLoaderData()
  const saveZone = useServerFn(saveAdminShippingZone)
  const deleteZone = useServerFn(deleteAdminShippingZone)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Record<string, unknown> | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<ShippingToast | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({})
  const normalizedSearch = search.trim().toLowerCase()

  const displayRows = useMemo(() => {
    const zoneIdsWithRates = new Set(rateRows.map((row) => row.zone_id).filter((id): id is string => typeof id === 'string'))
    const zoneOnlyRows = zoneRows
      .filter((zone) => !zoneIdsWithRates.has(zone.id))
      .map((zone) => createZoneOnlyDisplayRow(zone))

    return [...rateRows, ...zoneOnlyRows].sort((first, second) => {
      const firstZone = first.zone_name ?? ''
      const secondZone = second.zone_name ?? ''
      if (firstZone !== secondZone) return firstZone.localeCompare(secondZone)
      const firstWeight = Number(first.weight_min_kg ?? Number.MAX_SAFE_INTEGER)
      const secondWeight = Number(second.weight_min_kg ?? Number.MAX_SAFE_INTEGER)
      if (firstWeight !== secondWeight) return firstWeight - secondWeight
      return String(first.name).localeCompare(String(second.name))
    })
  }, [rateRows, zoneRows])

  const filteredRateRows = useMemo(() => (normalizedSearch
    ? displayRows.filter((row) => {
        const haystack = [
          row.zone_name,
          row.name,
          row.shipping_type,
          row.total_range,
          row.weight_range,
          row.kind,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalizedSearch)
      })
    : displayRows).reduce<Array<ShippingDisplayRow & { displayZone: boolean; groupIndex: number; groupEnd: boolean }>>((acc, row, index, list) => {
      const previous = list[index - 1]
      const next = list[index + 1]
      const displayZone = index === 0 || previous?.zone_name !== row.zone_name
      const groupIndex = displayZone ? acc.filter((item) => item.displayZone).length : acc[acc.length - 1]?.groupIndex ?? 0
      acc.push({
        ...row,
        displayZone,
        groupIndex,
        groupEnd: !next || next.zone_name !== row.zone_name,
      })
      return acc
    }, []), [displayRows, normalizedSearch])
  const pendingDeleteName = String(pendingDelete?.zone_name ?? pendingDelete?.zoneName ?? 'this shipping zone')

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function showToast(tone: ShippingToast['tone'], message: string) {
    setToast({ tone, message })
  }

  function openZoneEditor(row: Record<string, unknown> | null) {
    setToast(null)
    setEditing(row)
    setEditorOpen(true)
  }

  function zoneFromRateRow(row: ShippingDisplayRow) {
    return {
      id: row.zone_id,
      zone_name: row.zone_name,
      active: getZoneActive(row),
      apply_all_product: row.zone_apply_all_product,
      country_legacy_id: row.zone_country_legacy_id,
      apply_products_raw: row.zone_apply_products_raw,
      states_raw: row.zone_states_raw,
      shipping_rate_raw: row.zone_shipping_rate_raw,
      shipping_cod_rate_raw: row.zone_shipping_cod_rate_raw,
    }
  }

  function getZoneActive(row: ShippingDisplayRow) {
    return typeof row.zone_id === 'string' && row.zone_id in activeOverrides ? activeOverrides[row.zone_id] : Boolean(row.zone_active)
  }

  function formatRateRange(row: ShippingDisplayRow) {
    if (row.kind === 'zone') return '-'
    if (row.weight_min_kg != null || row.weight_max_kg != null) {
      return `${formatKg(row.weight_min_kg)} - ${formatKg(row.weight_max_kg)}`
    }
    if (row.weight_range) return normalizeKgRange(row.weight_range)
    if (row.shipping_type) return row.shipping_type
    if (row.total_range) return row.total_range
    return '-'
  }

  async function handleDeleteZone() {
    const id = pendingDelete?.id
    if (typeof id !== 'string') return

    setBusy(true)
    try {
      await deleteZone({ data: { id } })
      setPendingDelete(null)
      showToast('success', 'Shipping zone deleted.')
      await router.invalidate()
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleZoneActive(row: ShippingDisplayRow) {
    const formValues = getShippingZoneValues(zoneFromRateRow(row))
    if (!formValues.id) {
      showToast('error', 'This shipping zone cannot be updated because it is missing an ID.')
      return
    }

    const nextActive = !formValues.active
    setActiveOverrides((current) => ({ ...current, [formValues.id as string]: nextActive }))

    setBusy(true)
    setToast(null)
    try {
      await saveZone({
        data: {
          ...formValues,
          active: nextActive,
        },
      })
      showToast('success', `Shipping zone ${nextActive ? 'activated' : 'deactivated'}.`)
      await router.invalidate()
    } catch (error) {
      setActiveOverrides((current) => ({ ...current, [formValues.id as string]: formValues.active }))
      showToast('error', error instanceof Error ? error.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminModulePage
      title="Shipping"
      description=""
      badge="Shipping matrix"
      primaryAction="New zone"
      onPrimaryAction={() => {
        openZoneEditor(null)
      }}
      metrics={[]}
      rows={filteredRateRows}
      columns={[
        {
          header: 'Shipping Zone',
          cell: (row) => (
            row.displayZone ? (
              <button className="shipping-zone-link" type="button" onClick={() => openZoneEditor(zoneFromRateRow(row))}>
                {row.zone_name || row.shipping_zone_legacy_id || 'Unassigned zone'}
              </button>
            ) : <span aria-hidden="true" />
          ),
        },
        { header: 'Shipping Rate', cell: (row) => <span className="text-[#202223]">{row.name}</span> },
        { header: 'Range', cell: (row) => formatRateRange(row) },
        { header: 'Rate', cell: (row) => <span className="text-[#202223]">{row.kind === 'zone' ? '-' : formatMoney(Number(row.price), 'MYR').replace('MYR', 'RM')}</span> },
        {
          header: 'Active',
          className: 'shipping-active-column',
          cell: (row) => (
            row.displayZone ? (
              <button
                className="shipping-zone-active-toggle"
                type="button"
                aria-label={`${getZoneActive(row) ? 'Deactivate' : 'Activate'} ${row.zone_name || 'shipping zone'}`}
                aria-pressed={getZoneActive(row)}
                data-state={getZoneActive(row) ? 'active' : 'inactive'}
                disabled={busy}
                onClick={() => {
                  void handleToggleZoneActive(row)
                }}
              >
                <span />
              </button>
            ) : <span aria-hidden="true" />
          ),
        },
      ]}
      getRowKey={(row) => `${row.kind}-${row.id}`}
      getRowClassName={(row) => [
        'shipping-matrix-row',
        row.groupIndex % 2 === 0 ? 'shipping-matrix-row-even' : 'shipping-matrix-row-odd',
        row.displayZone ? 'shipping-matrix-row-start' : '',
        row.groupEnd ? 'shipping-matrix-row-end' : '',
      ].filter(Boolean).join(' ')}
      searchPlaceholder="Search zones, rates, ranges"
      searchValue={search}
      onSearchChange={setSearch}
      showSearch={false}
      showFilter={false}
      emptyMessage="No shipping rates found."
      rowActions={(row) => (
        row.displayZone ? (
          <div className="admin-row-actions">
            <button className="admin-row-action admin-row-action-secondary" type="button" onClick={() => openZoneEditor(zoneFromRateRow(row))}>
              <Pencil className="h-5 w-5" />
              Edit
            </button>
            <button
              className="admin-row-action admin-row-action-critical"
              type="button"
              onClick={() => {
                setToast(null)
                setPendingDelete(zoneFromRateRow(row))
              }}
            >
              <Trash2 className="h-5 w-5" />
              Delete
            </button>
          </div>
        ) : <span aria-hidden="true" />
      )}
    >
      <section className="products-tabs-card">
        <div className="products-tabs-toolbar">
          <label className="products-tabs-search">
            <Search className="h-5 w-5 shrink-0 text-[#616161]" />
            <input
              placeholder="Search zones, rates, ranges"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
      </section>

      {editorOpen ? (
        <ShippingZoneEditor
          zone={editing}
          rates={editing ? rateRows.filter((row) => row.kind === 'shipping' && row.zone_id === editing.id) : []}
          codRates={editing ? rateRows.filter((row) => row.kind === 'cod' && row.zone_id === editing.id) : []}
          formatRateRange={formatRateRange}
          busy={busy}
          onCancel={() => {
            if (busy) return
            setEditorOpen(false)
            setEditing(null)
          }}
          onSubmit={async (formValues) => {
            setBusy(true)
            try {
              await saveZone({
                data: {
                  id: formValues.id,
                  zoneName: formValues.zoneName,
                  active: formValues.active,
                  applyAllProduct: formValues.applyAllProduct,
                  countryLegacyId: formValues.countryLegacyId,
                  applyProductsRaw: formValues.applyProductsRaw,
                  statesRaw: formValues.statesRaw,
                  shippingRateRaw: formValues.shippingRateRaw,
                  shippingCodRateRaw: formValues.shippingCodRateRaw,
                },
              })
              setEditorOpen(false)
              setEditing(null)
              showToast('success', 'Shipping zone saved.')
              await router.invalidate()
            } catch (error) {
              showToast('error', error instanceof Error ? error.message : 'Save failed.')
            } finally {
              setBusy(false)
            }
          }}
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
          <section className="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-labelledby="delete-shipping-zone-title">
            <div className="modal-header">
              <h2 id="delete-shipping-zone-title" className="section-heading">Delete shipping zone?</h2>
            </div>
            <div className="modal-body">
              <p className="text-base text-[#202223]">
                Delete <span className="font-semibold">{pendingDeleteName}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="polaris-button polaris-button-secondary" type="button" onClick={() => setPendingDelete(null)} disabled={busy}>
                Cancel
              </button>
              <button className="polaris-button polaris-button-critical" type="button" onClick={handleDeleteZone} disabled={busy}>
                <Trash2 className="h-4 w-4" />
                Delete zone
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? <ShippingToast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </AdminModulePage>
  )
}

type ShippingZoneFormValues = {
  id?: string
  zoneName: string
  active: boolean
  applyAllProduct: boolean
  countryLegacyId: string
  applyProductsRaw: string
  statesRaw: string
  shippingRateRaw: string
  shippingCodRateRaw: string
}

function getShippingZoneValues(zone: Record<string, unknown> | null): ShippingZoneFormValues {
  return {
    id: typeof zone?.id === 'string' ? zone.id : undefined,
    zoneName: String(zone?.zone_name ?? ''),
    active: typeof zone?.active === 'boolean' ? zone.active : true,
    applyAllProduct: typeof zone?.apply_all_product === 'boolean' ? zone.apply_all_product : false,
    countryLegacyId: String(zone?.country_legacy_id ?? ''),
    applyProductsRaw: String(zone?.apply_products_raw ?? ''),
    statesRaw: String(zone?.states_raw ?? ''),
    shippingRateRaw: String(zone?.shipping_rate_raw ?? ''),
    shippingCodRateRaw: String(zone?.shipping_cod_rate_raw ?? ''),
  }
}

function createZoneOnlyDisplayRow(zone: ShippingZoneRow): ShippingDisplayRow {
  return {
    id: `zone-${zone.id}`,
    kind: 'zone',
    name: '-',
    price: null,
    shipping_type: null,
    total_range: null,
    weight_range: null,
    weight_min_kg: null,
    weight_max_kg: null,
    total_min: null,
    total_max: null,
    shipping_zone_legacy_id: null,
    zone_id: zone.id,
    zone_name: zone.zone_name,
    zone_active: zone.active,
    zone_apply_all_product: zone.apply_all_product,
    zone_country_legacy_id: zone.country_legacy_id,
    zone_apply_products_raw: zone.apply_products_raw,
    zone_states_raw: zone.states_raw,
    zone_shipping_rate_raw: zone.shipping_rate_raw,
    zone_shipping_cod_rate_raw: zone.shipping_cod_rate_raw,
  }
}

function ShippingZoneEditor({
  zone,
  rates,
  codRates,
  formatRateRange,
  busy,
  onCancel,
  onSubmit,
}: {
  zone: Record<string, unknown> | null
  rates: Array<ShippingRateRow>
  codRates: Array<ShippingRateRow>
  formatRateRange: (row: ShippingRateRow) => string
  busy: boolean
  onCancel: () => void
  onSubmit: (values: ShippingZoneFormValues) => Promise<void>
}) {
  const [values, setValues] = useState(() => getShippingZoneValues(zone))

  function update<K extends keyof ShippingZoneFormValues>(key: K, value: ShippingZoneFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(values)
  }

  return (
    <div className="modal-backdrop product-editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <section className="product-editor-panel shipping-editor-panel" role="dialog" aria-modal="true" aria-labelledby="shipping-editor-title">
        <form className="product-form-card shipping-editor-form" onSubmit={handleSubmit}>
          <div className="shipping-editor-header">
            <div>
              <h2 id="shipping-editor-title">Shipping</h2>
              <p>{values.zoneName || 'New shipping zone'}</p>
            </div>
            <div className="shipping-editor-actions">
              <button className="polaris-button polaris-button-primary" type="submit" disabled={busy}>
                <Save className="h-4 w-4" />
                Save
              </button>
              <button className="polaris-button polaris-button-secondary" type="button" onClick={onCancel} disabled={busy}>
                Go Back
              </button>
            </div>
          </div>

          <section className="shipping-form-section shipping-form-section-first">
            <h3>Shipping Zone</h3>
            <label className="product-field">
              <span className="product-field-label">Zone Name<b>*</b></span>
              <input className="form-input" value={values.zoneName} onChange={(event) => update('zoneName', event.target.value)} required />
            </label>
            <label className="product-field">
              <span className="product-field-label">Country<b>*</b></span>
              <input className="form-input" value={values.countryLegacyId} onChange={(event) => update('countryLegacyId', event.target.value)} placeholder="Malaysia" />
            </label>
            <label className="product-field">
              <span className="product-field-label">States<b>*</b></span>
              <StatePicker value={values.statesRaw} onChange={(nextValue) => update('statesRaw', nextValue)} />
            </label>
            <label className="shipping-checkbox-row">
              <input type="checkbox" checked={values.active} onChange={(event) => update('active', event.target.checked)} />
              Active
            </label>
            <label className="shipping-checkbox-row">
              <input type="checkbox" checked={values.applyAllProduct} onChange={(event) => update('applyAllProduct', event.target.checked)} />
              Apply this shipping zone to all product
            </label>
          </section>

          <ShippingRateSection title="Shipping Rate" buttonLabel="Add Rate" rates={rates} emptyMessage="Currently no rate" formatRateRange={formatRateRange} />
          <ShippingRateSection title="COD Fee Rate" buttonLabel="Add Fee" rates={codRates} emptyMessage="Currently no rate" formatRateRange={formatRateRange} />
        </form>
      </section>
    </div>
  )
}

function ShippingToast({
  tone,
  message,
  onDismiss,
}: {
  tone: ShippingToast['tone']
  message: string
  onDismiss: () => void
}) {
  const Icon = tone === 'success' ? CheckCircle2 : CircleAlert

  return (
    <div className="shipping-toast-region" role="status" aria-live="polite">
      <div className="shipping-toast" data-tone={tone}>
        <Icon className="h-5 w-5 shrink-0" />
        <span>{message}</span>
        <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function ShippingRateSection({
  title,
  buttonLabel,
  rates,
  emptyMessage,
  formatRateRange,
}: {
  title: string
  buttonLabel: string
  rates: Array<ShippingRateRow>
  emptyMessage: string
  formatRateRange: (row: ShippingRateRow) => string
}) {
  return (
    <section className="shipping-form-section">
      <div className="shipping-section-title-row">
        <h3>{title}</h3>
        <button className="polaris-button polaris-button-primary" type="button">{buttonLabel}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="shipping-rate-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Range</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={`${rate.kind}-${rate.id}`}>
                <td>{rate.name}</td>
                <td>{formatRateRange(rate)}</td>
                <td>{formatMoney(Number(rate.price), 'MYR').replace('MYR', 'RM')}</td>
                <td><span className="shipping-toggle" aria-label="Active" /></td>
                <td>
                  <div className="shipping-icon-actions">
                    <button type="button" aria-label={`Edit ${rate.name}`}><Pencil className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Delete ${rate.name}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rates.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#616161]">{emptyMessage}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function StatePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const selected = splitList(value)
  const selectedSet = new Set(selected)
  const customStates = selected.filter((state) => !MALAYSIA_STATES.includes(state))
  const selectedMalaysiaStates = MALAYSIA_STATES.filter((state) => selectedSet.has(state))

  function toggleState(state: string) {
    const nextMalaysiaStates = selectedSet.has(state)
      ? selectedMalaysiaStates.filter((selectedState) => selectedState !== state)
      : [...selectedMalaysiaStates, state]

    onChange([...customStates, ...nextMalaysiaStates].join(', '))
  }

  return (
    <div className="shipping-state-picker">
      <div className="shipping-chip-box">
        {selected.length > 0 ? (
          selected.map((state) => <span key={state} className="shipping-chip">{state}</span>)
        ) : <span className="section-muted">No states selected</span>}
      </div>
      {customStates.length > 0 ? (
        <p className="section-muted">
          Legacy values are preserved. Select Malaysia states below to add or remove supported states.
        </p>
      ) : null}
      <div className="shipping-state-grid">
        {MALAYSIA_STATES.map((state) => {
          const checked = selectedSet.has(state)
          return (
            <button
              key={state}
              className="shipping-state-option"
              type="button"
              aria-pressed={checked}
              data-state={checked ? 'selected' : 'unselected'}
              onClick={() => toggleState(state)}
            >
              <span className="shipping-state-checkbox" aria-hidden="true" />
              {state}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function formatKg(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return `${value}kg`
  return `${number.toFixed(2)}kg`
}

function normalizeKgRange(value: string) {
  const trimmed = value.trim()
  const bracketParts = trimmed.match(/^\[(.*)\]$/)?.[1].split(',').map((part) => part.trim()).filter(Boolean) ?? []
  if (bracketParts.length === 0 && /^\[\s*\]$/.test(trimmed)) return '-'
  if (bracketParts.length === 2) return `${formatKg(bracketParts[0])} - ${formatKg(bracketParts[1])}`
  if (bracketParts.length === 1) return formatKg(bracketParts[0])

  const parts = trimmed.split('-').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 2) {
    const min = parts[0].replace(/kg$/i, '').trim()
    const max = parts[1].replace(/kg$/i, '').trim()
    if (!min || !max) return '-'
    return `${formatKg(min)} - ${formatKg(max)}`
  }
  return trimmed.includes('kg') ? trimmed : `${trimmed}kg`
}
