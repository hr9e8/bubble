import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdminCrudPanel } from '../components/admin-crud-panel'
import { AdminModulePage } from '../components/admin-module-page'
import { Badge } from '../components/ui/badge'
import { deleteAdminUser, listAdminUsers, saveAdminUser } from '../lib/admin.functions'
import { titleCase } from '../lib/utils'

export const Route = createFileRoute('/admin/users')({
  loader: () => listAdminUsers(),
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const router = useRouter()
  const { rows, stats, roleOptions, platformOptions } = Route.useLoaderData()
  const saveUser = useServerFn(saveAdminUser)
  const deleteUser = useServerFn(deleteAdminUser)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const values = {
    id: editing?.id,
    name: editing?.name ?? '',
    email: editing?.email ?? '',
    phone: editing?.phone ?? '',
    userRole: editing?.user_role ?? '',
    distributorLevel: editing?.distributor_level ?? '',
    platformId: editing?.platform_id ?? '',
    salesTeamLocation: editing?.sales_team_location ?? '',
  }

  return (
    <AdminModulePage
      title="Users"
      description="Manage app users, Bubble profile parity fields, Better Auth links, role assignment, sales leaders, and warehouse relations."
      badge="Admin"
      primaryAction="Invite user"
      onPrimaryAction={() => setEditing(null)}
      metrics={[
        { label: 'Users', value: stats.users, detail: 'Imported app profiles' },
        { label: 'Roles', value: stats.roles, detail: 'Available base roles' },
        { label: 'Overrides', value: stats.overrides, detail: 'Direct user permissions' },
        { label: 'Leader links', value: stats.leaderLinks, detail: 'Active sales hierarchy' },
      ]}
      rows={rows}
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
        { header: 'Platform', cell: (row) => row.platform_name || row.sales_team_location || 'No platform' },
        { header: 'Distributor', cell: (row) => row.distributor_level || 'None' },
      ]}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search users"
      emptyMessage="No users found."
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
                await deleteUser({ data: { id: row.id } })
                setMessage('User deleted.')
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
        title={editing ? 'Edit user' : 'Create app user'}
        description="Creates and updates app user profile rows. Authentication accounts remain managed by Better Auth."
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'email', label: 'Email' },
          { name: 'phone', label: 'Phone' },
          { name: 'userRole', label: 'Role', type: 'select', options: roleOptions.map((role) => ({ value: role.name, label: titleCase(role.name) })) },
          { name: 'platformId', label: 'Platform', type: 'select', options: platformOptions.map((platform) => ({ value: platform.id, label: platform.name })) },
          { name: 'distributorLevel', label: 'Distributor level' },
          { name: 'salesTeamLocation', label: 'Sales team location' },
        ]}
        initialValues={values}
        submitLabel={editing ? 'Save user' : 'Create user'}
        busy={busy}
        message={message}
        onCancel={() => setEditing(null)}
        onSubmit={async (formValues) => {
          setBusy(true)
          try {
            await saveUser({
              data: {
                id: typeof values.id === 'string' ? values.id : undefined,
                name: String(formValues.name ?? ''),
                email: String(formValues.email ?? ''),
                phone: String(formValues.phone ?? ''),
                userRole: String(formValues.userRole ?? ''),
                distributorLevel: String(formValues.distributorLevel ?? ''),
                platformId: String(formValues.platformId ?? ''),
                salesTeamLocation: String(formValues.salesTeamLocation ?? ''),
              },
            })
            setEditing(null)
            setMessage('User saved.')
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
