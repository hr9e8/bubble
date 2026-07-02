import type { CurrentUserContext } from './auth-context'
import { getDatabase } from '../db/client'

export async function getManagedSalesMemberIds(userId: string) {
  const rows = await getDatabase()
    .selectFrom('sales_leader_members')
    .select('member_user_id')
    .where('leader_user_id', '=', userId)
    .where('active', '=', true)
    .execute()

  return rows.map((row) => row.member_user_id)
}

export async function getOrderScopeUserIds(user: CurrentUserContext) {
  if (user.permissions.includes('orders:all')) return null
  if (user.permissions.includes('orders:team')) {
    return Array.from(new Set([user.id, ...(await getManagedSalesMemberIds(user.id))]))
  }

  return [user.id]
}

export async function getStockScopeUserIds(user: CurrentUserContext) {
  if (user.permissions.includes('admin:manage') || user.permissions.includes('stock:warehouse')) return null
  if (user.permissions.includes('stock:team_transfer')) {
    return Array.from(new Set([user.id, ...(await getManagedSalesMemberIds(user.id))]))
  }

  return [user.id]
}

export function isUserIdWithinScope(userId: string | null | undefined, allowedUserIds: Array<string> | null) {
  if (allowedUserIds == null) return true
  if (!userId) return false
  return allowedUserIds.includes(userId)
}
