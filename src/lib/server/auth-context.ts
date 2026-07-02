import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth'
import { hasAnyRole, hasPermission, type PermissionKey } from '../business-rules'
import { getDatabase } from '../db/client'
import type { AppRoleName } from '../db/types'

export type CurrentUserContext = {
  id: string
  name: string
  email: string
  roles: Array<AppRoleName>
  permissions: Array<PermissionKey>
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden')
  }
}

export async function getOptionalCurrentUser() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) return null

  const db = getDatabase()
  const roles = await db
    .selectFrom('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .select('roles.name')
    .where('user_roles.user_id', '=', session.user.id)
    .execute()

  const rolePermissions = await db
    .selectFrom('user_roles')
    .innerJoin('role_permissions', 'role_permissions.role_id', 'user_roles.role_id')
    .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
    .select('permissions.key')
    .where('user_roles.user_id', '=', session.user.id)
    .execute()

  const userPermissions = await db
    .selectFrom('user_permissions')
    .innerJoin('permissions', 'permissions.id', 'user_permissions.permission_id')
    .select(['permissions.key', 'user_permissions.granted'])
    .where('user_permissions.user_id', '=', session.user.id)
    .execute()

  const denied = new Set(
    userPermissions
      .filter((permission) => !permission.granted)
      .map((permission) => permission.key as PermissionKey),
  )
  const granted = new Set<PermissionKey>()

  for (const permission of rolePermissions) {
    if (!denied.has(permission.key as PermissionKey)) {
      granted.add(permission.key as PermissionKey)
    }
  }

  for (const permission of userPermissions) {
    if (permission.granted) {
      granted.add(permission.key as PermissionKey)
    }
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: roles.map((role) => role.name),
    permissions: Array.from(granted),
  } satisfies CurrentUserContext
}

export async function requireCurrentUser(options?: {
  roles?: Array<AppRoleName>
  permissions?: Array<PermissionKey>
}) {
  const user = await getOptionalCurrentUser()
  if (!user) throw new UnauthorizedError()

  if (options?.roles?.length && !hasAnyRole(user.roles, options.roles)) {
    throw new ForbiddenError()
  }

  if (options?.permissions?.length) {
    const allowed = options.permissions.some((permission) => hasPermission(user.roles, permission, user.permissions))
    if (!allowed) throw new ForbiddenError()
  }

  return user
}

export async function writeAuditLog(input: {
  actorUserId: string
  action: string
  entityTable: string
  entityId?: string | null
  legacyBubbleId?: string | null
  beforeData?: unknown
  afterData?: unknown
  metadata?: unknown
}) {
  await getDatabase()
    .insertInto('audit_logs')
    .values({
      actor_user_id: input.actorUserId,
      action: input.action,
      entity_table: input.entityTable,
      entity_id: input.entityId ?? null,
      legacy_bubble_id: input.legacyBubbleId ?? null,
      before_data: input.beforeData == null ? null : JSON.stringify(input.beforeData),
      after_data: input.afterData == null ? null : JSON.stringify(input.afterData),
      metadata: JSON.stringify(input.metadata ?? {}),
    })
    .execute()
}
