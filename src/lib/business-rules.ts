import type { AppRoleName } from './db/types'

export type PermissionKey =
  | 'admin:manage'
  | 'orders:own'
  | 'orders:team'
  | 'orders:all'
  | 'stock:own'
  | 'stock:team_transfer'
  | 'stock:warehouse'
  | 'finance:verify'
  | 'warehouse:fulfill'
  | 'migration:run'
  | 'woocommerce:manage'

export const rolePermissions: Record<AppRoleName, Array<PermissionKey>> = {
  admin: [
    'admin:manage',
    'orders:own',
    'orders:team',
    'orders:all',
    'stock:own',
    'stock:team_transfer',
    'stock:warehouse',
    'finance:verify',
    'warehouse:fulfill',
    'migration:run',
    'woocommerce:manage',
  ],
  sales_team: ['orders:own', 'stock:own'],
  sales_leader: ['orders:own', 'orders:team', 'stock:own', 'stock:team_transfer'],
  finance: ['finance:verify'],
  warehouse_manager: ['stock:warehouse', 'warehouse:fulfill'],
}

export type MoneyInput = string | number | null | undefined

export function parseMoney(input: MoneyInput) {
  if (input == null || input === '') return 0
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0

  const normalized = input.replace(/,/g, '').replace(/[^\d.-]/g, '').trim()
  if (!normalized) return 0

  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

export function parseBubbleDate(input: string | null | undefined) {
  if (!input) return null

  const value = new Date(input)
  return Number.isNaN(value.getTime()) ? null : value
}

export type OrderTotalInput = {
  itemsSubtotal: number
  shippingTotal?: number
  codFee?: number
  transactionFee?: number
  discountAmount?: number
}

export function calculateOrderTotal(input: OrderTotalInput) {
  const subtotal = roundMoney(input.itemsSubtotal)
  const shipping = roundMoney(input.shippingTotal ?? 0)
  const codFee = roundMoney(input.codFee ?? 0)
  const transactionFee = roundMoney(input.transactionFee ?? 0)
  const discount = roundMoney(input.discountAmount ?? 0)
  const total = roundMoney(subtotal + shipping + codFee + transactionFee - discount)

  return {
    subtotal,
    shipping,
    codFee,
    transactionFee,
    discount,
    total: Math.max(0, total),
  }
}

export type ShippingRateCandidate = {
  active?: boolean | null
  shippingType?: string | null
  totalMin?: number | null
  totalMax?: number | null
  weightMinKg?: number | null
  weightMaxKg?: number | null
  price: number
}

export type ShippingRateInput = {
  shippingType?: string | null
  orderSubtotal: number
  weightKg: number
}

export function matchShippingRate(candidates: Array<ShippingRateCandidate>, input: ShippingRateInput) {
  return candidates.find((candidate) => {
    if (candidate.active === false) return false
    if (candidate.shippingType && input.shippingType && candidate.shippingType !== input.shippingType) return false
    if (candidate.totalMin != null && input.orderSubtotal < candidate.totalMin) return false
    if (candidate.totalMax != null && input.orderSubtotal > candidate.totalMax) return false
    if (candidate.weightMinKg != null && input.weightKg < candidate.weightMinKg) return false
    if (candidate.weightMaxKg != null && input.weightKg > candidate.weightMaxKg) return false
    return true
  })
}

export type StockMovementIntent =
  | 'admin_assign'
  | 'leader_transfer_out'
  | 'leader_transfer_in'
  | 'warehouse_receive'
  | 'warehouse_adjustment'
  | 'order_reserve'
  | 'order_release'
  | 'order_fulfill'
  | 'order_cancel'
  | 'manual_correction'

const negativeStockIntents: Array<StockMovementIntent> = ['leader_transfer_out', 'order_reserve', 'order_fulfill']
const signedStockIntents: Array<StockMovementIntent> = ['warehouse_adjustment', 'manual_correction']

export function signedStockQuantity(intent: StockMovementIntent, quantity: number) {
  const normalized = signedStockIntents.includes(intent)
    ? Math.trunc(quantity)
    : Math.abs(Math.trunc(quantity))

  if (normalized === 0) {
    throw new Error('Stock movement quantity must be non-zero.')
  }

  return negativeStockIntents.includes(intent) ? -normalized : normalized
}

export function pairedLeaderTransferQuantities(quantity: number) {
  const normalized = Math.abs(Math.trunc(quantity))
  if (normalized === 0) {
    throw new Error('Leader transfer quantity must be non-zero.')
  }

  return {
    transferOut: -normalized,
    transferIn: normalized,
  }
}

export function hasPermission(roles: Array<AppRoleName>, permission: PermissionKey, directPermissions: Array<PermissionKey> = []) {
  if (directPermissions.includes(permission)) return true
  return roles.some((role) => rolePermissions[role].includes(permission))
}

export function hasAnyRole(roles: Array<AppRoleName>, allowedRoles: Array<AppRoleName>) {
  return roles.some((role) => allowedRoles.includes(role))
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
