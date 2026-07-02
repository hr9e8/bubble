import { Save, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

export type AdminCrudValue = string | number | boolean | null | undefined

export type AdminCrudField = {
  name: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'checkbox' | 'select'
  required?: boolean
  placeholder?: string
  step?: string
  min?: number
  options?: Array<{ value: string; label: string }>
  className?: string
}

type AdminCrudPanelProps = {
  title: string
  description?: string
  fields: Array<AdminCrudField>
  initialValues: Record<string, AdminCrudValue>
  submitLabel: string
  presentation?: 'inline' | 'modal'
  busy?: boolean
  message?: string | null
  onCancel?: () => void
  onSubmit: (values: Record<string, AdminCrudValue>) => Promise<void>
}

function normalizeValues(fields: Array<AdminCrudField>, values: Record<string, AdminCrudValue>) {
  return fields.reduce<Record<string, AdminCrudValue>>((next, field) => {
    next[field.name] = values[field.name] ?? (field.type === 'checkbox' ? false : '')
    return next
  }, {})
}

function valuesResetKey(fields: Array<AdminCrudField>, values: Record<string, AdminCrudValue>) {
  return JSON.stringify({
    fields: fields.map((field) => [field.name, field.type ?? 'text']),
    values: fields.map((field) => [field.name, values[field.name] ?? null]),
  })
}

export function AdminCrudPanel({
  title,
  description,
  fields,
  initialValues,
  submitLabel,
  presentation = 'inline',
  busy,
  message,
  onCancel,
  onSubmit,
}: AdminCrudPanelProps) {
  const [values, setValues] = useState(() => normalizeValues(fields, initialValues))
  const resetKey = valuesResetKey(fields, initialValues)

  useEffect(() => {
    setValues(normalizeValues(fields, initialValues))
  }, [resetKey])

  useEffect(() => {
    if (presentation !== 'modal' || !onCancel) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel?.()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, presentation])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(values)
  }

  const header = (
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="section-heading">{title}</h2>
        {description ? <p className="section-muted mt-1">{description}</p> : null}
      </div>
      {onCancel ? (
        <button className="polaris-button polaris-button-secondary w-fit" type="button" onClick={onCancel} aria-label={presentation === 'modal' ? 'Close' : undefined}>
          <X className="h-4 w-4" />
          {presentation === 'modal' ? null : 'Clear'}
        </button>
      ) : null}
    </div>
  )

  const form = (
    <form id="admin-crud-panel-form" className={`grid gap-3 ${presentation === 'modal' ? 'md:grid-cols-2' : 'mt-4 md:grid-cols-2 xl:grid-cols-4'}`} onSubmit={handleSubmit}>
      {fields.map((field) => {
        const value = values[field.name]
        const className = field.className ?? ''

        if (field.type === 'textarea') {
          return (
            <label key={field.name} className={`grid gap-1 text-sm font-medium text-[#202223] md:col-span-2 ${className}`}>
              {field.label}
              <textarea
                className="form-textarea min-h-24"
                value={String(value ?? '')}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                placeholder={field.placeholder}
                required={field.required}
              />
            </label>
          )
        }

        if (field.type === 'select') {
          return (
            <label key={field.name} className={`grid gap-1 text-sm font-medium text-[#202223] ${className}`}>
              {field.label}
              <select
                className="form-select"
                value={String(value ?? '')}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                required={field.required}
              >
                <option value="">None</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )
        }

        if (field.type === 'checkbox') {
          return (
            <label key={field.name} className={`flex items-center gap-2 self-end rounded border border-[#dcdfe4] px-3 py-2 text-sm font-medium text-[#202223] ${className}`}>
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))}
              />
              {field.label}
            </label>
          )
        }

        return (
          <label key={field.name} className={`grid gap-1 text-sm font-medium text-[#202223] ${className}`}>
            {field.label}
            <input
              className="form-input"
              type={field.type ?? 'text'}
              min={field.min}
              step={field.step}
              value={String(value ?? '')}
              onChange={(event) => {
                const next = field.type === 'number' ? Number(event.target.value) : event.target.value
                setValues((current) => ({ ...current, [field.name]: event.target.value === '' ? '' : next }))
              }}
              placeholder={field.placeholder}
              required={field.required}
            />
          </label>
        )
      })}

      {presentation === 'inline' ? (
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
          <button className="polaris-button polaris-button-primary" type="submit" disabled={busy}>
            <Save className="h-4 w-4" />
            {submitLabel}
          </button>
          {message ? <p className="section-muted">{message}</p> : null}
        </div>
      ) : null}
    </form>
  )

  if (presentation === 'modal') {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.()
      }}>
        <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-crud-panel-title">
          <div className="modal-header">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="admin-crud-panel-title" className="section-heading">{title}</h2>
                {description ? <p className="section-muted mt-1">{description}</p> : null}
              </div>
              {onCancel ? (
                <button className="polaris-button polaris-button-secondary" type="button" onClick={onCancel} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="modal-body">{form}</div>
          <div className="modal-footer">
            {message ? <p className="section-muted mr-auto self-center">{message}</p> : null}
            {onCancel ? (
              <button className="polaris-button polaris-button-secondary" type="button" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
            ) : null}
            <button className="polaris-button polaris-button-primary" type="submit" form="admin-crud-panel-form" disabled={busy}>
              <Save className="h-4 w-4" />
              {submitLabel}
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <section className="section-card p-4">
      {header}
      {form}
    </section>
  )
}
