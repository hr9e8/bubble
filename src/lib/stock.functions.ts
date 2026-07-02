import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'
import { pairedLeaderTransferQuantities, signedStockQuantity, type StockMovementIntent } from './business-rules'
import { countValue } from './server/db-helpers'

const movementInput = z.object({
  movementType: z.enum([
    'admin_assign',
    'leader_transfer_out',
    'leader_transfer_in',
    'warehouse_receive',
    'warehouse_adjustment',
    'order_reserve',
    'order_release',
    'order_fulfill',
    'order_cancel',
    'manual_correction',
  ]),
  productId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  userRelatedId: z.string().optional(),
  warehousePlatformId: z.string().uuid().optional(),
  quantity: z.number().int(),
  remark: z.string().optional(),
})

const leaderTransferInput = z.object({
  productId: z.string().uuid(),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  quantity: z.number().int().positive(),
  remark: z.string().optional(),
})

const getServerDeps = createServerOnlyFn(async () => {
  const [kysely, db, authContext, salesScope] = await Promise.all([
    import('kysely'),
    import('./db/client'),
    import('./server/auth-context'),
    import('./server/sales-scope'),
  ])

  return { sql: kysely.sql, ...db, ...authContext, ...salesScope }
})

export const getStockOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, getStockScopeUserIds, requireCurrentUser, sql } = await getServerDeps()
  const user = await requireCurrentUser({ permissions: ['stock:own', 'stock:warehouse', 'admin:manage'] })
  const scopedUserIds = await getStockScopeUserIds(user)

  let availableQuery = getDatabase()
    .selectFrom('stock_balance_ledger')
    .select((eb) => eb.fn.sum('available_quantity').as('value'))

  let committedQuery = getDatabase()
    .selectFrom('stock_movements')
    .select(() =>
      sql<number>`coalesce(sum(case
        when movement_type = 'order_reserve' then abs(quantity)
        when movement_type in ('order_release', 'order_cancel', 'order_fulfill') then -abs(quantity)
        else 0
      end), 0)`.as('value'),
    )

  let lowStockQuery = getDatabase()
    .selectFrom('stock_balance_ledger')
    .innerJoin('products', 'products.id', 'stock_balance_ledger.product_id')
    .select((eb) => eb.fn.countAll().as('count'))
    .whereRef('stock_balance_ledger.available_quantity', '<=', 'products.reorder_level')
    .where('products.reorder_level', 'is not', null)

  if (scopedUserIds != null) {
    availableQuery = availableQuery.where('owner_user_id', 'in', scopedUserIds)
    committedQuery = committedQuery.where('user_related_id', 'in', scopedUserIds)
    lowStockQuery = lowStockQuery.where('owner_user_id', 'in', scopedUserIds)
  }

  const [available, committed, lowStock] = await Promise.all([
    availableQuery.executeTakeFirst(),
    committedQuery.executeTakeFirst(),
    lowStockQuery.executeTakeFirst(),
  ])

  return {
    available: countValue(available?.value),
    committed: countValue(committed?.value),
    lowStock: countValue(lowStock?.count),
  }
})

export const listStockFormOptions = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, getStockScopeUserIds, requireCurrentUser } = await getServerDeps()
  const user = await requireCurrentUser({ permissions: ['stock:own', 'stock:team_transfer', 'stock:warehouse', 'admin:manage'] })
  const scopedUserIds = await getStockScopeUserIds(user)

  const products = getDatabase()
    .selectFrom('products')
    .select(['id', 'name', 'sku_code'])
    .where('status_ready', '=', true)
    .orderBy('name')
    .limit(300)
    .execute()

  const warehouses = getDatabase()
    .selectFrom('warehouse_platforms')
    .select(['id', 'name', 'order_prefix'])
    .orderBy('name')
    .limit(200)
    .execute()

  const usersQuery = getDatabase()
    .selectFrom('auth_users')
    .select(['id', 'name', 'email'])
    .orderBy('name')
    .limit(300)

  const [productRows, warehouseRows, userRows] = await Promise.all([
    products,
    warehouses,
    scopedUserIds == null ? usersQuery.execute() : usersQuery.where('id', 'in', scopedUserIds).execute(),
  ])

  return {
    products: productRows,
    warehouses: warehouseRows,
    users: userRows,
    currentUserId: user.id,
  }
})

export const listStockMovements = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase, getStockScopeUserIds, requireCurrentUser } = await getServerDeps()
  const user = await requireCurrentUser({ permissions: ['stock:own', 'stock:warehouse', 'admin:manage'] })
  const scopedUserIds = await getStockScopeUserIds(user)

  let query = getDatabase()
    .selectFrom('stock_movements')
    .leftJoin('products', 'products.id', 'stock_movements.product_id')
    .select([
      'stock_movements.id',
      'stock_movements.movement_type',
      'stock_movements.quantity',
      'stock_movements.user_related_id',
      'stock_movements.created_at',
      'products.name as product_name',
      'products.sku_code',
    ])
    .orderBy('stock_movements.created_at', 'desc')
    .limit(100)

  if (scopedUserIds != null) {
    query = query.where('stock_movements.user_related_id', 'in', scopedUserIds)
  }

  return query.execute()
})

export const createStockMovement = createServerFn({ method: 'POST' })
  .validator(movementInput)
  .handler(async ({ data }) => {
    const { ForbiddenError, getDatabase, getStockScopeUserIds, isUserIdWithinScope, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const requiredPermission =
      data.movementType === 'admin_assign'
        ? 'admin:manage'
        : data.movementType.startsWith('leader_transfer')
          ? 'stock:team_transfer'
          : data.movementType.startsWith('warehouse')
            ? 'stock:warehouse'
            : 'stock:own'

    const user = await requireCurrentUser({ permissions: [requiredPermission] })
    const quantity = signedStockQuantity(data.movementType as StockMovementIntent, data.quantity)
    const scopedUserIds = await getStockScopeUserIds(user)
    const targetUserId = data.userRelatedId ?? user.id

    if (!isUserIdWithinScope(targetUserId, scopedUserIds)) {
      throw new ForbiddenError()
    }

    const movement = await getDatabase()
      .insertInto('stock_movements')
      .values({
        movement_type: data.movementType,
        product_id: data.productId,
        order_id: data.orderId ?? null,
        user_related_id: targetUserId,
        warehouse_platform_id: data.warehousePlatformId ?? null,
        quantity,
        remark: data.remark ?? null,
        created_by_user_id: user.id,
      })
      .returning(['id', 'movement_type', 'quantity'])
      .executeTakeFirstOrThrow()

    await writeAuditLog({ actorUserId: user.id, action: 'stock.movement.create', entityTable: 'stock_movements', entityId: movement.id, afterData: movement })
    return movement
  })

export const createLeaderStockTransfer = createServerFn({ method: 'POST' })
  .validator(leaderTransferInput)
  .handler(async ({ data }) => {
    const { ForbiddenError, getDatabase, getStockScopeUserIds, isUserIdWithinScope, requireCurrentUser, writeAuditLog } = await getServerDeps()
    const user = await requireCurrentUser({ permissions: ['stock:team_transfer'] })
    const scopedUserIds = await getStockScopeUserIds(user)

    if (!isUserIdWithinScope(data.fromUserId, scopedUserIds) || !isUserIdWithinScope(data.toUserId, scopedUserIds)) {
      throw new ForbiddenError()
    }

    if (data.fromUserId === data.toUserId) {
      throw new Error('Transfer source and destination must differ.')
    }

    const quantities = pairedLeaderTransferQuantities(data.quantity)
    const db = getDatabase()

    const movements = await db.transaction().execute(async (trx) => {
      const transferOut = await trx
        .insertInto('stock_movements')
        .values({
          movement_type: 'leader_transfer_out',
          product_id: data.productId,
          user_related_id: data.fromUserId,
          quantity: quantities.transferOut,
          remark: data.remark ?? null,
          created_by_user_id: user.id,
        })
        .returning(['id', 'movement_type', 'quantity', 'user_related_id'])
        .executeTakeFirstOrThrow()

      const transferIn = await trx
        .insertInto('stock_movements')
        .values({
          movement_type: 'leader_transfer_in',
          product_id: data.productId,
          user_related_id: data.toUserId,
          quantity: quantities.transferIn,
          remark: data.remark ?? null,
          created_by_user_id: user.id,
        })
        .returning(['id', 'movement_type', 'quantity', 'user_related_id'])
        .executeTakeFirstOrThrow()

      return { transferOut, transferIn }
    })

    await writeAuditLog({
      actorUserId: user.id,
      action: 'stock.leader_transfer',
      entityTable: 'stock_movements',
      entityId: movements.transferOut.id,
      afterData: movements,
    })

    return movements
  })
