import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ChevronDown, ChevronRight, Pencil, Save, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminRole, listAdminRoles, saveAdminRole } from '../lib/admin.functions'
import { titleCase } from '../lib/utils'

export const Route = createFileRoute('/admin/roles')({
  loader: () => listAdminRoles(),
  component: AdminRolesPage,
})

function AdminRolesPage() {
  const router = useRouter()
  const { rows, stats, permissionOptions } = Route.useLoaderData()
  const saveRole = useServerFn(saveAdminRole)
  const deleteRole = useServerFn(deleteAdminRole)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formResetKey, setFormResetKey] = useState(0)
  const values = useMemo(
    () => ({
      id: editing?.id,
      name: editing?.name ?? 'sales_team',
      description: editing?.description ?? '',
      permissionKeys: Array.isArray(editing?.permissions) ? editing.permissions : [],
    }),
    [editing, formResetKey],
  )

  return (
    <AdminModulePage
      title="Roles and permissions"
      description="Define role grants and audit-sensitive administrative access."
      badge="RBAC"
      primaryAction="New role"
      onPrimaryAction={() => {
        setEditing(null)
        setMessage(null)
        setFormResetKey((key) => key + 1)
      }}
      metrics={[
        { label: 'Roles', value: stats.roles, detail: 'Seeded application roles' },
        { label: 'Permissions', value: stats.permissions, detail: 'Permission registry keys' },
        { label: 'Role grants', value: stats.roleGrants, detail: 'Role-to-permission links' },
        { label: 'Overrides', value: stats.overrides, detail: 'Direct user grants or denies' },
      ]}
      rows={rows}
      columns={[
        {
          header: 'Role',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{titleCase(row.name.replace(/_/g, ' '))}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.description || 'No description'}</p>
            </div>
          ),
        },
        { header: 'Permissions', cell: (row) => row.permissions.length },
        {
          header: 'Access',
          cell: (row) => (
            <div className="flex max-w-[34rem] flex-wrap gap-2">
              {row.permissions.slice(0, 6).map((permission) => (
                <Badge key={permission} tone="neutral">{permission}</Badge>
              ))}
              {row.permissions.length > 6 ? <Badge tone="info">+{row.permissions.length - 6}</Badge> : null}
            </div>
          ),
        },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search roles or permissions"
      emptyMessage="No roles found."
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
              if (!window.confirm(`Delete ${titleCase(row.name)}?`)) return
              setBusy(true)
              try {
                await deleteRole({ data: { id: row.id } })
                setMessage('Role deleted.')
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
      <RoleEditor
        editing={Boolean(editing)}
        initialValues={values}
        permissionOptions={permissionOptions}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async ({ name, description, permissionIds }) => {
          setBusy(true)
          try {
            await saveRole({
              data: {
                id: typeof values.id === 'string' ? values.id : undefined,
                name,
                description,
                permissionIds,
              },
            })
            setEditing(null)
            setMessage('Role saved.')
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

type PermissionOption = {
  id: string
  key: string
  description: string | null
}

type RoleEditorValues = {
  id: unknown
  name: unknown
  description: unknown
  permissionKeys: Array<unknown>
}

const roleOptions = ['admin', 'sales_team', 'sales_leader', 'finance', 'warehouse_manager'] as const

function getPermissionCategory(permissionKey: string) {
  return permissionKey.includes(':') ? permissionKey.split(':')[0] : 'general'
}

function permissionLabel(permissionKey: string) {
  return titleCase(permissionKey.replace(/[:_.-]+/g, ' '))
}

function RoleEditor({
  editing,
  initialValues,
  permissionOptions,
  busy,
  message,
  onCancel,
  onSubmit,
}: {
  editing: boolean
  initialValues: RoleEditorValues
  permissionOptions: Array<PermissionOption>
  busy?: boolean
  message?: string | null
  onCancel: () => void
  onSubmit: (values: { name: (typeof roleOptions)[number]; description: string; permissionIds: Array<string> }) => Promise<void>
}) {
  const [name, setName] = useState<(typeof roleOptions)[number]>('sales_team')
  const [description, setDescription] = useState('')
  const [roleCategory, setRoleCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const permissionKeyToId = useMemo(() => new Map(permissionOptions.map((permission) => [permission.key, permission.id])), [permissionOptions])

  const groupedPermissions = useMemo(() => {
    return permissionOptions.reduce<Array<{ category: string; permissions: Array<PermissionOption> }>>((groups, permission) => {
      const category = getPermissionCategory(permission.key)
      const existing = groups.find((group) => group.category === category)
      if (existing) {
        existing.permissions.push(permission)
      } else {
        groups.push({ category, permissions: [permission] })
      }
      return groups
    }, [])
  }, [permissionOptions])

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return groupedPermissions
      .filter((group) => roleCategory === 'all' || group.category === roleCategory)
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => {
          if (!normalizedQuery) return true
          return `${permission.key} ${permission.description ?? ''}`.toLowerCase().includes(normalizedQuery)
        }),
      }))
      .filter((group) => group.permissions.length > 0)
  }, [groupedPermissions, query, roleCategory])

  const visiblePermissionIds = visibleGroups.flatMap((group) => group.permissions.map((permission) => permission.id))
  const allVisibleSelected = visiblePermissionIds.length > 0 && visiblePermissionIds.every((id) => selectedPermissionIds.has(id))
  const categoryOptions = ['all', ...groupedPermissions.map((group) => group.category)]

  useEffect(() => {
    const nextName = roleOptions.includes(initialValues.name as (typeof roleOptions)[number])
      ? (initialValues.name as (typeof roleOptions)[number])
      : 'sales_team'
    const permissionIds = initialValues.permissionKeys
      .map((key) => permissionKeyToId.get(String(key)))
      .filter((id): id is string => Boolean(id))

    setName(nextName)
    setDescription(String(initialValues.description ?? ''))
    setSelectedPermissionIds(new Set(permissionIds))
    setRoleCategory('all')
    setQuery('')
    setExpandedCategories(new Set(groupedPermissions.map((group) => group.category)))
  }, [groupedPermissions, initialValues, permissionKeyToId])

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((current) => {
      const next = new Set(current)
      if (next.has(permissionId)) {
        next.delete(permissionId)
      } else {
        next.add(permissionId)
      }
      return next
    })
  }

  function toggleVisiblePermissions() {
    setSelectedPermissionIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        visiblePermissionIds.forEach((id) => next.delete(id))
      } else {
        visiblePermissionIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleCategory(category: string) {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  function toggleAllCategories() {
    setExpandedCategories((current) => {
      if (current.size === groupedPermissions.length) return new Set()
      return new Set(groupedPermissions.map((group) => group.category))
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit({ name, description, permissionIds: Array.from(selectedPermissionIds) })
  }

  return (
    <section className="section-card p-0">
      <form onSubmit={handleSubmit}>
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#dedede] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button className="polaris-button polaris-button-tertiary px-2" type="button" onClick={onCancel} aria-label="Back to role list">
              <X className="h-4 w-4" />
            </button>
            <h2 className="section-heading text-base">{editing ? 'Edit role' : 'Add role'}</h2>
          </div>
          <button className="polaris-button polaris-button-primary" type="submit" disabled={busy}>
            <Save className="h-4 w-4" />
            {editing ? 'Save role' : 'Create role'}
          </button>
        </div>

        <div className="grid gap-3 p-4">
          <div className="app-box grid gap-3 p-3">
            <label className="form-field">
              <span className="form-label">Name</span>
              <select className="form-select" value={name} onChange={(event) => setName(event.target.value as (typeof roleOptions)[number])} required>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {titleCase(role)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span className="form-label">Description</span>
              <input className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>

          <div className="app-box p-0">
            <div className="grid gap-3 border-b border-[#ebebeb] p-3">
              <div>
                <h3 className="section-heading">Permissions</h3>
                <p className="form-help">Role category determines the visible permission groups.</p>
              </div>

              <select className="form-select" value={roleCategory} onChange={(event) => setRoleCategory(event.target.value)}>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All permissions' : `${titleCase(category)} role`}
                  </option>
                ))}
              </select>

              <label className="control-surface flex items-center gap-2 px-3 text-sm">
                <Search className="h-4 w-4 shrink-0 text-[#616161]" />
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 outline-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                />
              </label>
            </div>

            <div className="divide-y divide-[#ebebeb]">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <label className="choice-row min-w-0">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisiblePermissions} disabled={visiblePermissionIds.length === 0} />
                  <span>Select all permissions</span>
                </label>
                <button className="app-link shrink-0 text-xs" type="button" onClick={toggleAllCategories}>
                  {expandedCategories.size === groupedPermissions.length ? 'Collapse all' : 'Expand all'}
                </button>
              </div>

              {visibleGroups.map((group) => {
                const selectedCount = group.permissions.filter((permission) => selectedPermissionIds.has(permission.id)).length
                const expanded = expandedCategories.has(group.category)

                return (
                  <div key={group.category}>
                    <button
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-[#202223] hover:bg-[#f7f7f7]"
                      type="button"
                      onClick={() => toggleCategory(group.category)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCount === group.permissions.length}
                          ref={(input) => {
                            if (input) input.indeterminate = selectedCount > 0 && selectedCount < group.permissions.length
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => {
                            const groupIds = group.permissions.map((permission) => permission.id)
                            const allSelected = groupIds.every((id) => selectedPermissionIds.has(id))
                            setSelectedPermissionIds((current) => {
                              const next = new Set(current)
                              groupIds.forEach((id) => {
                                if (allSelected) {
                                  next.delete(id)
                                } else {
                                  next.add(id)
                                }
                              })
                              return next
                            })
                          }}
                        />
                        <span className="truncate">{titleCase(group.category)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-[#616161]">
                        {selectedCount}/{group.permissions.length}
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="grid gap-1 bg-[#fafafa] px-8 py-2">
                        {group.permissions.map((permission) => (
                          <label key={permission.id} className="choice-row rounded px-2 py-1.5 hover:bg-[#f1f1f1]">
                            <input
                              type="checkbox"
                              checked={selectedPermissionIds.has(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                            />
                            <span>
                              <span className="block text-sm font-medium text-[#202223]">{permissionLabel(permission.key)}</span>
                              {permission.description ? <span className="form-help">{permission.description}</span> : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {visibleGroups.length === 0 ? <p className="section-muted px-4 py-8 text-center">No permissions match this search.</p> : null}
            </div>
          </div>

          {message ? <p className="section-muted">{message}</p> : null}
        </div>
      </form>
    </section>
  )
}
