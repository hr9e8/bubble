import { rolePermissions, type PermissionKey } from '../business-rules'
import { getDatabase } from '../db/client'
import type { AppRoleName } from '../db/types'
import type { CurrentUserContext } from '../server/auth-context'

export async function getMcpCurrentUser(): Promise<CurrentUserContext> {
  const userId = process.env.MCP_USER_ID?.trim()
  const userEmail = process.env.MCP_USER_EMAIL?.trim()

  if (!userId && !userEmail) {
    throw new Error('Set MCP_USER_ID or MCP_USER_EMAIL to choose the dashboard user identity for MCP calls.')
  }

  let query = getDatabase().selectFrom('auth_users').select(['id', 'name', 'email'])

  if (userId) {
    query = query.where('id', '=', userId)
  } else if (userEmail) {
    query = query.where('email', '=', userEmail)
  }

  const user = await query.executeTakeFirst()

  if (!user) {
    throw new Error('The MCP dashboard user was not found.')
  }

  const roles = await getDatabase()
    .selectFrom('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .select('roles.name')
    .where('user_roles.user_id', '=', user.id)
    .execute()

  const roleNames = roles.map((role) => role.name)
  const permissions = new Set<PermissionKey>()

  for (const role of roleNames) {
    for (const permission of rolePermissions[role]) {
      permissions.add(permission)
    }
  }

  const directPermissions = await getDatabase()
    .selectFrom('user_permissions')
    .innerJoin('permissions', 'permissions.id', 'user_permissions.permission_id')
    .select(['permissions.key', 'user_permissions.granted'])
    .where('user_permissions.user_id', '=', user.id)
    .execute()

  for (const permission of directPermissions) {
    const key = permission.key as PermissionKey
    if (permission.granted) {
      permissions.add(key)
    } else {
      permissions.delete(key)
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: roleNames as Array<AppRoleName>,
    permissions: Array.from(permissions),
  }
}
