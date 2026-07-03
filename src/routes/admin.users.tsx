import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Save, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminUser, listAdminUsers, saveAdminUser } from '../lib/admin.functions'
import { titleCase } from '../lib/utils'

export const Route = createFileRoute('/admin/users')({
  loader: () => listAdminUsers(),
  component: AdminUsersPage,
})

type UserFormValues = {
  name: string
  email: string
  phone: string
  userRole: string
  platformId: string
  warehouseNames: Array<string>
  profileImageUrl: string
  profileImage?: ProfileImageInput
}

type ProfileImageInput = {
  filename: string
  contentType: string
  base64: string
}

const emptyUserForm: UserFormValues = {
  name: '',
  email: '',
  phone: '',
  userRole: '',
  platformId: '',
  warehouseNames: [],
  profileImageUrl: '',
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeOptionLabel(value: string) {
  return titleCase(value.replace(/_/g, ' '))
}

function buildRoleOptions(roleNames: Array<string>, currentRole: string) {
  const options = roleNames.map((role) => ({ value: role, label: normalizeOptionLabel(role) }))
  if (currentRole && !options.some((option) => option.value === currentRole)) {
    options.push({ value: currentRole, label: normalizeOptionLabel(currentRole) })
  }
  return options
}

function splitRelationList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildUserFormValues(
  row: Record<string, unknown> | null,
  platformOptions: Array<{ id: string; name: string }>,
  roleNames: Array<string>,
): UserFormValues {
  if (!row) return emptyUserForm

  const currentRole = stringValue(row.user_role)
  const platformSalesTeam = stringValue(row.platform_sales_team)
  const platformId = stringValue(row.platform_id)
    || platformOptions.find((platform) => platform.name.toLowerCase() === platformSalesTeam.toLowerCase())?.id
    || ''
  const warehouseNames = Array.isArray(row.warehouse_names)
    ? row.warehouse_names.filter((name): name is string => typeof name === 'string')
    : splitRelationList(stringValue(row.warehouse_relation_raw))

  return {
    name: stringValue(row.name),
    email: stringValue(row.email),
    phone: stringValue(row.phone),
    userRole: roleNames.includes(currentRole)
      ? currentRole
      : roleNames.find((role) => normalizeOptionLabel(role).toLowerCase() === currentRole.toLowerCase()) ?? currentRole,
    platformId,
    warehouseNames,
    profileImageUrl: stringValue(row.profile_image_url),
  }
}

function readImageFile(file: File) {
  return new Promise<ProfileImageInput>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const [, base64 = ''] = result.split(',')
      resolve({
        filename: file.name,
        contentType: file.type || 'image/jpeg',
        base64,
      })
    }
    reader.onerror = () => reject(new Error('Could not read image file.'))
    reader.readAsDataURL(file)
  })
}

function AdminUsersPage() {
  const router = useRouter()
  const { rows, stats, roleOptions, platformOptions, warehouseOptions } = Route.useLoaderData()
  const saveUser = useServerFn(saveAdminUser)
  const deleteUser = useServerFn(deleteAdminUser)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Record<string, unknown> | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formValues, setFormValues] = useState<UserFormValues>(emptyUserForm)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = normalizedSearch
    ? rows.filter((row) => {
        const haystack = [
          row.name,
          row.email,
          row.phone,
          row.user_role,
          row.platform_name,
          row.platform_sales_team,
          row.distributor_level,
          row.sales_team_location,
          row.warehouse_names?.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalizedSearch)
      })
    : rows
  const pendingDeleteName = String(pendingDelete?.name ?? 'this user')
  const roleOptionsForForm = buildRoleOptions(roleOptions.map((role) => role.name), stringValue(editing?.user_role))
  const warehouseChoices = warehouseOptions.filter((warehouse) => !formValues.warehouseNames.includes(warehouse.name))

  useEffect(() => {
    if (!editorOpen) return
    setFormValues(buildUserFormValues(editing, platformOptions, roleOptions.map((role) => role.name)))
  }, [editing, editorOpen, platformOptions, roleOptions])

  function updateFormValue(name: keyof UserFormValues, value: string) {
    setFormValues((current) => ({ ...current, [name]: value }))
  }

  async function handleProfileImageChange(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Upload an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Profile image must be 5 MB or smaller.')
      return
    }

    try {
      const profileImage = await readImageFile(file)
      setFormValues((current) => ({
        ...current,
        profileImage,
        profileImageUrl: `data:${profileImage.contentType};base64,${profileImage.base64}`,
      }))
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image upload failed.')
    }
  }

  function addWarehouse(warehouseName: string) {
    if (!warehouseName) return
    setFormValues((current) => current.warehouseNames.includes(warehouseName)
      ? current
      : { ...current, warehouseNames: [...current.warehouseNames, warehouseName] })
  }

  function removeWarehouse(warehouseName: string) {
    setFormValues((current) => ({
      ...current,
      warehouseNames: current.warehouseNames.filter((name) => name !== warehouseName),
    }))
  }

  async function handleSubmitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      await saveUser({
        data: {
          id: typeof editing?.id === 'string' ? editing.id : undefined,
          name: formValues.name,
          email: formValues.email,
          phone: formValues.phone,
          userRole: formValues.userRole,
          distributorLevel: '',
          platformId: formValues.platformId,
          salesTeamLocation: '',
          warehouseNames: formValues.warehouseNames,
          profileImage: formValues.profileImage,
        },
      })
      setEditorOpen(false)
      setEditing(null)
      setMessage('User saved.')
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteUser() {
    const id = pendingDelete?.id
    if (typeof id !== 'string') return

    setBusy(true)
    try {
      await deleteUser({ data: { id } })
      setPendingDelete(null)
      setMessage('User deleted.')
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminModulePage
      title="Users"
      description=""
      badge="Admin"
      primaryAction="Create user"
      onPrimaryAction={() => {
        setEditing(null)
        setEditorOpen(true)
      }}
      metrics={[
        { label: 'Users', value: stats.users, detail: 'Imported app profiles' },
        { label: 'Roles', value: stats.roles, detail: 'Available base roles' },
        { label: 'Overrides', value: stats.overrides, detail: 'Direct user permissions' },
        { label: 'Leader links', value: stats.leaderLinks, detail: 'Active sales hierarchy' },
      ]}
      rows={filteredRows}
      columns={[
        {
          header: 'User',
          cell: (row) => (
            <div>
              <p className="font-semibold text-[#202223]">{row.name}</p>
              <p className="mt-1 text-sm text-[#616161]">{row.email || row.phone || 'No contact captured'}</p>
            </div>
          ),
        },
        { header: 'Role', cell: (row) => <Badge tone="neutral">{titleCase(row.user_role) || 'Unassigned'}</Badge> },
        { header: 'Platform', cell: (row) => row.platform_name || row.platform_sales_team || 'No platform' },
        { header: 'Distributor', cell: (row) => row.distributor_level || 'None' },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search users"
      searchValue={search}
      onSearchChange={setSearch}
      showFilter={false}
      emptyMessage="No users found."
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
      {editorOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setEditorOpen(false)
              setEditing(null)
            }
          }}
        >
          <section className="modal-panel" style={{ width: 'min(100%, 72rem)' }} role="dialog" aria-modal="true" aria-labelledby="admin-user-form-title">
            <div className="modal-header">
              <div className="flex items-start justify-between gap-4">
                <h2 id="admin-user-form-title" className="section-heading">{editing ? 'Edit user' : 'Create user'}</h2>
                <button
                  className="polaris-button polaris-button-secondary"
                  type="button"
                  onClick={() => {
                    setEditorOpen(false)
                    setEditing(null)
                  }}
                  aria-label="Close"
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <form id="admin-user-form" onSubmit={handleSubmitUser}>
              <div className="modal-body grid gap-6">
                <div className="border-b border-[#dedede] pb-6">
                  <div className="admin-user-photo-control">
                    <div className="admin-user-avatar-preview" aria-hidden="true">
                      {formValues.profileImageUrl ? (
                        <img src={formValues.profileImageUrl} alt="" />
                      ) : (
                        <span>{formValues.name.trim().slice(0, 1).toUpperCase() || 'U'}</span>
                      )}
                    </div>
                    <div className="grid gap-1">
                      <button className="polaris-button polaris-button-secondary w-fit" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                        <Upload className="h-4 w-4" />
                        {formValues.profileImageUrl ? 'Change photo' : 'Upload photo'}
                      </button>
                      <p className="section-muted">JPG, PNG, or WebP. Max 5 MB.</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      className="sr-only"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => {
                        void handleProfileImageChange(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 border-b border-[#dedede] pb-6 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-[#202223]">
                    Name
                    <input className="form-input" value={formValues.name} onChange={(event) => updateFormValue('name', event.target.value)} required />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-[#202223]">
                    Email
                    <input className="form-input" type="email" value={formValues.email} onChange={(event) => updateFormValue('email', event.target.value)} />
                  </label>
                </div>

                <div className="grid gap-4 border-b border-[#dedede] pb-6 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-[#202223]">
                    Phone Number
                    <input className="form-input" value={formValues.phone} onChange={(event) => updateFormValue('phone', event.target.value)} placeholder="+60123456789" />
                  </label>
                </div>

                <div className="admin-user-permissions-row">
                  <label className="admin-user-field">
                    <span className="admin-user-label">User Role</span>
                    <select className="form-select" value={formValues.userRole} onChange={(event) => updateFormValue('userRole', event.target.value)}>
                      <option value="">None</option>
                      {roleOptionsForForm.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-user-field">
                    <span className="admin-user-label">Sales Team Platform</span>
                    <select className="form-select" value={formValues.platformId} onChange={(event) => updateFormValue('platformId', event.target.value)}>
                      <option value="">None</option>
                      {platformOptions.map((platform) => (
                        <option key={platform.id} value={platform.id}>{platform.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="admin-user-field">
                    <span className="admin-user-label">Warehouse Platform</span>
                    {formValues.warehouseNames.length > 0 ? (
                      <div className="admin-user-warehouse-box">
                        <div className="admin-user-chip-list">
                          {formValues.warehouseNames.map((warehouseName) => (
                            <button
                              key={warehouseName}
                              className="admin-user-chip"
                              type="button"
                              onClick={() => removeWarehouse(warehouseName)}
                            >
                              <X className="h-3.5 w-3.5" />
                              {warehouseName}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <select className="form-select" value="" onChange={(event) => addWarehouse(event.target.value)}>
                      <option value="">None</option>
                      {warehouseChoices.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.name}>{warehouse.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editing ? (
                  <div className="grid gap-3 border-b border-[#dedede] pb-6">
                    <p className="text-sm font-medium text-[#202223]">Change Password (send email password reset)</p>
                    <button className="polaris-button polaris-button-secondary w-fit" type="button" disabled>
                      Send Email Reset
                    </button>
                  </div>
                ) : null}

                {message ? <p className="section-muted">{message}</p> : null}
              </div>
              <div className="modal-footer">
                <button
                  className="polaris-button polaris-button-secondary"
                  type="button"
                  onClick={() => {
                    setEditorOpen(false)
                    setEditing(null)
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="polaris-button polaris-button-primary" type="submit" disabled={busy}>
                  <Save className="h-4 w-4" />
                  {editing ? 'Edit User' : 'Create User'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setPendingDelete(null)
          }}
        >
          <section className="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
            <div className="modal-header">
              <h2 id="delete-user-title" className="section-heading">Delete user?</h2>
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
              <button className="polaris-button polaris-button-critical" type="button" onClick={handleDeleteUser} disabled={busy}>
                <Trash2 className="h-4 w-4" />
                Delete user
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AdminModulePage>
  )
}
