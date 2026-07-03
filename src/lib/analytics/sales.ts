import { sql } from 'kysely'
import { z } from 'zod'
import { countValue } from '../server/db-helpers'
import { getDatabase } from '../db/client'
import type { CurrentUserContext } from '../server/auth-context'
import { getOrderScopeUserIds } from '../server/sales-scope'

const defaultOrderStatuses = ['pending_payment', 'finance_hold', 'verified', 'packing', 'shipped'] as const
const buckets = ['day', 'week', 'month'] as const

export const salesAnalyticsInput = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  statuses: z.array(z.string().min(1)).optional(),
})

export const salesTrendInput = salesAnalyticsInput.extend({
  bucket: z.enum(buckets).default('month'),
})

export const productVelocityInput = salesAnalyticsInput.extend({
  limit: z.number().int().min(1).max(50).default(10),
  direction: z.enum(['fast', 'slow']).default('fast'),
})

export type SalesAnalyticsInput = z.infer<typeof salesAnalyticsInput>
export type SalesTrendInput = z.infer<typeof salesTrendInput>
export type ProductVelocityInput = z.infer<typeof productVelocityInput>

function parseDateRange(input: SalesAnalyticsInput) {
  const dateTo = input.dateTo ? new Date(input.dateTo) : new Date()
  const dateFrom = input.dateFrom ? new Date(input.dateFrom) : new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000)

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new Error('dateFrom and dateTo must be valid ISO date strings.')
  }

  if (dateFrom > dateTo) {
    throw new Error('dateFrom must be before dateTo.')
  }

  return {
    dateFrom,
    dateTo,
    statuses: input.statuses?.length ? input.statuses : [...defaultOrderStatuses],
  }
}

function moneyValue(value: string | number | bigint | null | undefined) {
  if (value == null) return 0
  return Number(value)
}

export async function getSalesOverview(user: CurrentUserContext, input: SalesAnalyticsInput = {}) {
  const range = parseDateRange(input)
  const scopedUserIds = await getOrderScopeUserIds(user)

  let query = getDatabase()
    .selectFrom('orders')
    .select((eb) => [
      eb.fn.countAll().as('order_count'),
      eb.fn.sum('total_amount').as('revenue'),
      eb.fn.avg('total_amount').as('average_order_value'),
      eb.fn.sum('item_quantity_total').as('units_sold'),
    ])
    .where('created_at', '>=', range.dateFrom)
    .where('created_at', '<=', range.dateTo)
    .where('order_status', 'in', range.statuses)

  if (scopedUserIds != null) {
    query = query.where('seller_user_id', 'in', scopedUserIds)
  }

  const totals = await query.executeTakeFirst()

  return {
    scope: scopedUserIds == null ? 'all' : scopedUserIds.length > 1 ? 'team' : 'own',
    dateFrom: range.dateFrom.toISOString(),
    dateTo: range.dateTo.toISOString(),
    statuses: range.statuses,
    revenue: moneyValue(totals?.revenue),
    averageOrderValue: moneyValue(totals?.average_order_value),
    orderCount: countValue(totals?.order_count),
    unitsSold: countValue(totals?.units_sold),
  }
}

export async function getSalesTrend(user: CurrentUserContext, input: SalesTrendInput) {
  const range = parseDateRange(input)
  const scopedUserIds = await getOrderScopeUserIds(user)
  const bucketExpression = sql<Date>`date_trunc(${input.bucket}, created_at)`

  let query = getDatabase()
    .selectFrom('orders')
    .select((eb) => [
      bucketExpression.as('bucket_start'),
      eb.fn.countAll().as('order_count'),
      eb.fn.sum('total_amount').as('revenue'),
      eb.fn.avg('total_amount').as('average_order_value'),
    ])
    .where('created_at', '>=', range.dateFrom)
    .where('created_at', '<=', range.dateTo)
    .where('order_status', 'in', range.statuses)
    .groupBy(bucketExpression)
    .orderBy('bucket_start', 'asc')

  if (scopedUserIds != null) {
    query = query.where('seller_user_id', 'in', scopedUserIds)
  }

  const rows = await query.execute()

  return {
    bucket: input.bucket,
    scope: scopedUserIds == null ? 'all' : scopedUserIds.length > 1 ? 'team' : 'own',
    dateFrom: range.dateFrom.toISOString(),
    dateTo: range.dateTo.toISOString(),
    statuses: range.statuses,
    points: rows.map((row) => ({
      bucketStart: new Date(row.bucket_start).toISOString(),
      revenue: moneyValue(row.revenue),
      averageOrderValue: moneyValue(row.average_order_value),
      orderCount: countValue(row.order_count),
    })),
  }
}

export async function getProductVelocity(user: CurrentUserContext, input: ProductVelocityInput) {
  const range = parseDateRange(input)
  const scopedUserIds = await getOrderScopeUserIds(user)

  let query = getDatabase()
    .selectFrom('order_items')
    .innerJoin('orders', 'orders.id', 'order_items.order_id')
    .leftJoin('products', 'products.id', 'order_items.product_id')
    .select((eb) => [
      'order_items.product_id',
      'products.name as product_name',
      'products.sku_code as sku_code',
      eb.fn.sum('order_items.quantity').as('units_sold'),
      eb.fn.sum('order_items.order_line_total').as('revenue'),
      sql<number>`count(distinct orders.id)`.as('order_count'),
    ])
    .where('orders.created_at', '>=', range.dateFrom)
    .where('orders.created_at', '<=', range.dateTo)
    .where('orders.order_status', 'in', range.statuses)
    .groupBy(['order_items.product_id', 'products.name', 'products.sku_code'])
    .orderBy('units_sold', input.direction === 'fast' ? 'desc' : 'asc')
    .limit(input.limit)

  if (scopedUserIds != null) {
    query = query.where('orders.seller_user_id', 'in', scopedUserIds)
  }

  const rows = await query.execute()

  return {
    direction: input.direction,
    scope: scopedUserIds == null ? 'all' : scopedUserIds.length > 1 ? 'team' : 'own',
    dateFrom: range.dateFrom.toISOString(),
    dateTo: range.dateTo.toISOString(),
    statuses: range.statuses,
    products: rows.map((row) => ({
      productId: row.product_id,
      name: row.product_name ?? 'Unmapped product',
      sku: row.sku_code,
      unitsSold: countValue(row.units_sold),
      revenue: moneyValue(row.revenue),
      orderCount: countValue(row.order_count),
    })),
  }
}
