import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Database } from './db/types'
import { countValue } from './server/db-helpers'
import { formatInternationalPhone } from './utils'

type AdminCountTable = Extract<
  keyof Database,
  | 'app_users'
  | 'products'
  | 'shipping_zones'
  | 'woocommerce_stores'
  | 'roles'
  | 'permissions'
  | 'role_permissions'
  | 'user_permissions'
  | 'product_credit_rates'
  | 'product_credits'
  | 'shipping_countries'
  | 'shipping_states'
  | 'shipping_couriers'
  | 'shipping_rates'
  | 'shipping_cod_rates'
  | 'shipping_accounts'
  | 'sales_team_platforms'
  | 'warehouse_platforms'
  | 'order_website_owners'
  | 'stock_lots'
  | 'stock_movements'
  | 'stock_balances'
  | 'stock_warehouses'
  | 'warehouse_user_relations'
>

const requireAdmin = createServerOnlyFn(async () => {
  const { requireCurrentUser } = await import('./server/auth-context')
  return requireCurrentUser({ permissions: ['admin:manage'] })
})

const optionalString = z.string().trim().optional().transform((value) => value || null)
const optionalNumber = z.coerce.number().finite().optional().nullable().transform((value) => value ?? null)
const optionalInt = z.coerce.number().int().optional().nullable().transform((value) => value ?? null)
const uuid = z.string().uuid()
const optionalUuid = z.string().trim().optional().transform((value) => value || null).pipe(z.string().uuid().nullable())

function splitRelationList(value: string | null | undefined) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function uniqueValues(values: Array<string>) {
  return Array.from(new Set(values.filter(Boolean)))
}

const productInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1),
  skuCode: optionalString,
  manufacturerBarcode: optionalString,
  categoryId: optionalUuid,
  description: optionalString,
  productType: optionalString,
  shortform: optionalString,
  supplierName: optionalString,
  priceRetail: z.coerce.number().finite().default(0),
  priceDistributor: z.coerce.number().finite().default(0),
  weightG: optionalInt,
  lengthCm: optionalNumber,
  heightCm: optionalNumber,
  reorderLevel: optionalInt,
  statusReady: z.coerce.boolean().default(true),
  creditRequired: z.coerce.boolean().default(false),
  creditValue: optionalNumber,
  customBundlePrice: optionalNumber,
  hideRetail: z.coerce.boolean().default(false),
  hideDistributor: z.coerce.boolean().default(false),
})

const userInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1),
  email: optionalString,
  phone: optionalString,
  userRole: optionalString,
  distributorLevel: optionalString,
  platformId: optionalUuid,
  salesTeamLocation: optionalString,
  warehouseNames: z.array(z.string().trim().min(1)).default([]),
  profileImage: z.object({
    filename: z.string().trim().min(1),
    contentType: z.string().regex(/^image\//),
    base64: z.string().min(1),
  }).optional(),
})

const roleInput = z.object({
  id: uuid.optional(),
  name: z.enum(['admin', 'sales_team', 'sales_leader', 'finance', 'warehouse_manager']),
  description: optionalString,
  permissionIds: z.array(uuid).default([]),
})

const bundleInput = z.object({
  id: uuid.optional(),
  bundleProductId: optionalUuid,
  childProductId: optionalUuid,
  bundleProductCode: optionalString,
  productCode: optionalString,
  productCategory: optionalString,
  quantity: optionalInt,
  priceRetail: optionalNumber,
  priceDistributor: optionalNumber,
})

const creditRateInput = z.object({
  id: uuid.optional(),
  rate: z.coerce.number().finite(),
  active: z.coerce.boolean().default(false),
})

const productPricingInput = z.object({
  id: uuid,
  priceRetail: z.coerce.number().finite().default(0),
  priceDistributor: z.coerce.number().finite().default(0),
  customBundlePrice: optionalNumber,
  creditRequired: z.coerce.boolean().default(false),
  creditValue: optionalNumber,
  hideRetail: z.coerce.boolean().default(false),
  hideDistributor: z.coerce.boolean().default(false),
})

const shippingZoneInput = z.object({
  id: uuid.optional(),
  zoneName: z.string().trim().min(1),
  active: z.coerce.boolean().default(true),
  applyAllProduct: z.coerce.boolean().default(false),
  countryLegacyId: optionalString,
  applyProductsRaw: optionalString,
  statesRaw: optionalString,
  shippingRateRaw: optionalString,
  shippingCodRateRaw: optionalString,
})

const courierInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1),
  trackingUrl: optionalString,
  legacySlug: optionalString,
})

const salesPlatformInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1),
  orderPrefix: optionalString,
  platformCategory: optionalString,
  financeApprovalActive: z.coerce.boolean().default(false),
  orderMinLimitApproval: optionalNumber,
  url: optionalString,
})

const warehousePlatformInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1),
  orderPrefix: optionalString,
  stockRaw: optionalString,
  stockMovementRaw: optionalString,
})

const stockBalanceInput = z.object({
  id: uuid.optional(),
  productId: uuid,
  ownerUserId: optionalString,
  warehousePlatformId: optionalUuid,
  availableQuantity: z.coerce.number().int().default(0),
  committedQuantity: z.coerce.number().int().default(0),
  reorderLevel: optionalInt,
})

const deleteInput = z.object({ id: uuid })

const getAdminDeps = createServerOnlyFn(async () => {
  const [db, authContext] = await Promise.all([import('./db/client'), import('./server/auth-context')])
  return { ...db, ...authContext }
})

async function auditAdminChange(input: {
  action: string
  table: string
  id?: string | null
  before?: unknown
  after?: unknown
}) {
  const { requireCurrentUser, writeAuditLog } = await import('./server/auth-context')
  const user = await requireCurrentUser({ permissions: ['admin:manage'] })
  await writeAuditLog({
    actorUserId: user.id,
    action: input.action,
    entityTable: input.table,
    entityId: input.id,
    beforeData: input.before,
    afterData: input.after,
  })
}

const countTable = createServerOnlyFn(async (table: AdminCountTable) => {
  const { getDatabase } = await import('./db/client')
  const row = await getDatabase()
    .selectFrom(table)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirst()

  return countValue(row?.count)
})

export const getAdminOverview = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()

  const [users, products, shippingZones, woocommerceStores] = await Promise.all([
    countTable('app_users'),
    countTable('products'),
    countTable('shipping_zones'),
    countTable('woocommerce_stores'),
  ])

  return { users, products, shippingZones, woocommerceStores }
})

export const listRolesAndPermissions = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  return getDatabase()
    .selectFrom('roles')
    .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
    .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
    .select(['roles.id', 'roles.name', 'roles.description', 'permissions.key as permission_key'])
    .orderBy('roles.name')
    .orderBy('permissions.key')
    .execute()
})

export const listAdminUsers = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [rows, total, roles, overrides, leaderLinks, roleOptions, platformOptions, warehouseOptions] = await Promise.all([
    getDatabase()
      .selectFrom('app_users')
      .leftJoin('sales_team_platforms', 'sales_team_platforms.id', 'app_users.platform_id')
      .leftJoin('files as profile_images', 'profile_images.id', 'app_users.profile_image_file_id')
      .select([
        'app_users.id',
        'app_users.name',
        'app_users.email',
        'app_users.phone',
        'app_users.user_role',
        'app_users.platform_sales_team',
        'app_users.distributor_level',
        'app_users.sales_team_location',
        'app_users.warehouse_relation_raw',
        'app_users.platform_id',
        'app_users.profile_image_file_id',
        'sales_team_platforms.name as platform_name',
        'profile_images.public_url as profile_image_url',
      ])
      .orderBy('app_users.name')
      .limit(50)
      .execute(),
    countTable('app_users'),
    countTable('roles'),
    countTable('user_permissions'),
    getDatabase()
      .selectFrom('sales_leader_members')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('active', '=', true)
      .executeTakeFirst(),
    getDatabase().selectFrom('roles').select(['id', 'name']).orderBy('name').execute(),
    getDatabase().selectFrom('sales_team_platforms').select(['id', 'name']).orderBy('name').execute(),
    getDatabase().selectFrom('warehouse_platforms').select(['id', 'name']).orderBy('name').execute(),
  ])
  const userNames = rows.map((row) => row.name).filter(Boolean)
  const relationTokens = uniqueValues(rows.flatMap((row) => splitRelationList(row.warehouse_relation_raw)))
  const warehouseRelations = userNames.length > 0
    ? await getDatabase()
        .selectFrom('warehouse_user_relations')
        .select(['user_name', 'warehouse_name', 'legacy_slug'])
        .where((eb) => {
          const conditions = [eb('user_name', 'in', userNames)]
          if (relationTokens.length > 0) conditions.push(eb('legacy_slug', 'in', relationTokens))
          return eb.or(conditions)
        })
        .orderBy('warehouse_name')
        .execute()
    : []
  const warehousesByUserName = warehouseRelations.reduce<Record<string, Array<string>>>((acc, relation) => {
    if (!relation.user_name) return acc
    acc[relation.user_name] = [...(acc[relation.user_name] ?? []), relation.warehouse_name]
    return acc
  }, {})
  const warehousesByRelationToken = warehouseRelations.reduce<Record<string, string>>((acc, relation) => {
    if (relation.legacy_slug) acc[relation.legacy_slug] = relation.warehouse_name
    return acc
  }, {})
  const warehouseOptionNames = new Set(warehouseOptions.map((warehouse) => warehouse.name))

  return {
    rows: rows.map((row) => ({
      ...row,
      phone: formatInternationalPhone(row.phone) || null,
      warehouse_names: uniqueValues(
        warehousesByUserName[row.name]
          ?? splitRelationList(row.warehouse_relation_raw)
            .map((token) => warehousesByRelationToken[token] ?? token)
            .filter((name) => warehouseOptionNames.has(name)),
      ),
    })),
    roleOptions,
    platformOptions,
    warehouseOptions,
    stats: {
      users: total,
      roles,
      overrides,
      leaderLinks: countValue(leaderLinks?.count),
    },
  }
})

export const listAdminRoles = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [roleRows, permissionRows, overrides] = await Promise.all([
    getDatabase()
      .selectFrom('roles')
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .leftJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select(['roles.id', 'roles.name', 'roles.description', 'permissions.key as permission_key'])
      .orderBy('roles.name')
      .orderBy('permissions.key')
      .execute(),
    getDatabase().selectFrom('permissions').select(['id', 'key', 'description']).orderBy('key').execute(),
    countTable('user_permissions'),
  ])

  const roles = Array.from(
    roleRows.reduce((map, row) => {
      const existing = map.get(row.id) ?? {
        id: row.id,
        name: row.name,
        description: row.description,
        permissions: [] as Array<string>,
      }
      if (row.permission_key) existing.permissions.push(row.permission_key)
      map.set(row.id, existing)
      return map
    }, new Map<string, { id: string; name: string; description: string | null; permissions: Array<string> }>())
      .values(),
  )

  return {
    rows: roles,
    stats: {
      roles: roles.length,
      permissions: permissionRows.length,
      roleGrants: roleRows.filter((row) => row.permission_key).length,
      overrides,
    },
    permissionOptions: permissionRows,
  }
})

export const listAdminProducts = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [rows, total, categories, creditProducts, hiddenRetail, categoryOptions] = await Promise.all([
    getDatabase()
      .selectFrom('products')
      .leftJoin('product_categories', 'product_categories.id', 'products.category_id')
      .leftJoin('files as product_images', 'product_images.id', 'products.image_file_id')
      .select([
        'products.id',
        'products.name',
        'products.description',
        'products.sku_code',
        'products.manufacturer_barcode',
        'products.category_id',
        'products.product_type',
        'products.shortform',
        'products.supplier_name',
        'products.price_retail',
        'products.price_distributor',
        'products.weight_g',
        'products.length_cm',
        'products.height_cm',
        'products.reorder_level',
        'products.status_ready',
        'products.credit_required',
        'products.credit_value',
        'products.custom_bundle_price',
        'products.hide_retail',
        'products.hide_distributor',
        'products.created_at',
        'product_categories.name as category_name',
        'product_images.public_url as image_url',
      ])
      .orderBy('products.updated_at', 'desc')
      .execute(),
    countTable('products'),
    getDatabase().selectFrom('product_categories').select((eb) => eb.fn.countAll().as('count')).executeTakeFirst(),
    getDatabase().selectFrom('products').select((eb) => eb.fn.countAll().as('count')).where('credit_required', '=', true).executeTakeFirst(),
    getDatabase().selectFrom('products').select((eb) => eb.fn.countAll().as('count')).where('hide_retail', '=', true).executeTakeFirst(),
    getDatabase().selectFrom('product_categories').select(['id', 'name']).orderBy('name').execute(),
  ])

  return {
    rows,
    stats: {
      products: total,
      categories: countValue(categories?.count),
      creditProducts: countValue(creditProducts?.count),
      hiddenRetail: countValue(hiddenRetail?.count),
    },
    categoryOptions,
  }
})

export const listAdminPricing = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [products, creditRates, productCredits, customBundlePrices] = await Promise.all([
    getDatabase()
      .selectFrom('products')
      .select([
        'id',
        'name',
        'sku_code',
        'price_retail',
        'price_distributor',
        'custom_bundle_price',
        'credit_required',
        'credit_value',
        'hide_retail',
        'hide_distributor',
      ])
      .orderBy('updated_at', 'desc')
      .limit(50)
      .execute(),
    getDatabase().selectFrom('product_credit_rates').select(['id', 'active', 'rate', 'updated_at']).orderBy('updated_at', 'desc').limit(10).execute(),
    countTable('product_credits'),
    getDatabase().selectFrom('products').select((eb) => eb.fn.countAll().as('count')).where('custom_bundle_price', 'is not', null).executeTakeFirst(),
  ])

  return {
    rows: products,
    creditRates,
    stats: {
      pricedProducts: products.length,
      creditRates: creditRates.length,
      productCredits,
      customBundlePrices: countValue(customBundlePrices?.count),
    },
  }
})

export const listAdminShipping = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [rows, shippingRates, shippingCodRates, zones, countries, states, rates, codRates] = await Promise.all([
    getDatabase()
      .selectFrom('shipping_zones')
      .select([
        'id',
        'zone_name',
        'active',
        'apply_all_product',
        'country_legacy_id',
        'apply_products_raw',
        'states_raw',
        'shipping_rate_raw',
        'shipping_cod_rate_raw',
      ])
      .orderBy('zone_name')
      .limit(50)
      .execute(),
    getDatabase()
      .selectFrom('shipping_rates')
      .leftJoin('shipping_zones', 'shipping_zones.legacy_bubble_id', 'shipping_rates.shipping_zone_legacy_id')
      .select([
        'shipping_rates.id',
        'shipping_rates.name',
        'shipping_rates.shipping_price as price',
        'shipping_rates.shipping_type',
        'shipping_rates.total_range',
        'shipping_rates.weight_range_kg as weight_range',
        'shipping_rates.weight_min_kg',
        'shipping_rates.weight_max_kg',
        'shipping_rates.total_min',
        'shipping_rates.total_max',
        'shipping_rates.shipping_zone_legacy_id',
        'shipping_zones.id as zone_id',
        'shipping_zones.zone_name as zone_name',
        'shipping_zones.active as zone_active',
        'shipping_zones.apply_all_product as zone_apply_all_product',
        'shipping_zones.country_legacy_id as zone_country_legacy_id',
        'shipping_zones.apply_products_raw as zone_apply_products_raw',
        'shipping_zones.states_raw as zone_states_raw',
        'shipping_zones.shipping_rate_raw as zone_shipping_rate_raw',
        'shipping_zones.shipping_cod_rate_raw as zone_shipping_cod_rate_raw',
      ])
      .orderBy('shipping_zones.zone_name')
      .orderBy('shipping_rates.weight_min_kg')
      .orderBy('shipping_rates.total_min')
      .orderBy('shipping_rates.name')
      .limit(100)
      .execute(),
    getDatabase()
      .selectFrom('shipping_cod_rates')
      .leftJoin('shipping_zones', 'shipping_zones.legacy_bubble_id', 'shipping_cod_rates.shipping_zone_legacy_id')
      .select([
        'shipping_cod_rates.id',
        'shipping_cod_rates.name',
        'shipping_cod_rates.cod_price as price',
        'shipping_cod_rates.shipping_type',
        'shipping_cod_rates.total_range',
        'shipping_cod_rates.weight_range',
        'shipping_cod_rates.weight_min_kg',
        'shipping_cod_rates.weight_max_kg',
        'shipping_cod_rates.total_min',
        'shipping_cod_rates.total_max',
        'shipping_cod_rates.shipping_zone_legacy_id',
        'shipping_zones.id as zone_id',
        'shipping_zones.zone_name as zone_name',
        'shipping_zones.active as zone_active',
        'shipping_zones.apply_all_product as zone_apply_all_product',
        'shipping_zones.country_legacy_id as zone_country_legacy_id',
        'shipping_zones.apply_products_raw as zone_apply_products_raw',
        'shipping_zones.states_raw as zone_states_raw',
        'shipping_zones.shipping_rate_raw as zone_shipping_rate_raw',
        'shipping_zones.shipping_cod_rate_raw as zone_shipping_cod_rate_raw',
      ])
      .orderBy('shipping_zones.zone_name')
      .orderBy('shipping_cod_rates.weight_min_kg')
      .orderBy('shipping_cod_rates.total_min')
      .orderBy('shipping_cod_rates.name')
      .limit(100)
      .execute(),
    countTable('shipping_zones'),
    countTable('shipping_countries'),
    countTable('shipping_states'),
    countTable('shipping_rates'),
    countTable('shipping_cod_rates'),
  ])

  return {
    rows,
    rateRows: [
      ...shippingRates.map((rate) => ({ ...rate, kind: 'shipping' as const })),
      ...shippingCodRates.map((rate) => ({ ...rate, kind: 'cod' as const })),
    ].sort((first, second) => {
      const firstZone = first.zone_name ?? ''
      const secondZone = second.zone_name ?? ''
      if (firstZone !== secondZone) return firstZone.localeCompare(secondZone)
      const firstWeight = Number(first.weight_min_kg ?? Number.MAX_SAFE_INTEGER)
      const secondWeight = Number(second.weight_min_kg ?? Number.MAX_SAFE_INTEGER)
      if (firstWeight !== secondWeight) return firstWeight - secondWeight
      return String(first.name).localeCompare(String(second.name))
    }),
    stats: { zones, countries, states, rates, codRates },
  }
})

export const listAdminCouriers = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [rows, couriers, accounts, manifests, warehouseEvents] = await Promise.all([
    getDatabase()
      .selectFrom('shipping_couriers')
      .select(['id', 'name', 'tracking_url', 'legacy_slug', 'created_by', 'updated_at'])
      .orderBy('name')
      .limit(50)
      .execute(),
    countTable('shipping_couriers'),
    countTable('shipping_accounts'),
    getDatabase().selectFrom('order_manifests').select((eb) => eb.fn.countAll().as('count')).executeTakeFirst(),
    getDatabase().selectFrom('warehouse_events').select((eb) => eb.fn.countAll().as('count')).executeTakeFirst(),
  ])

  return {
    rows,
    stats: {
      couriers,
      accounts,
      manifests: countValue(manifests?.count),
      warehouseEvents: countValue(warehouseEvents?.count),
    },
  }
})

export const listAdminPlatforms = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [rows, salesPlatforms, warehousePlatforms, websiteOwners, wooStores] = await Promise.all([
    getDatabase()
      .selectFrom('sales_team_platforms')
      .select(['id', 'name', 'order_prefix', 'platform_category', 'finance_approval_active', 'order_min_limit_approval', 'url'])
      .orderBy('name')
      .limit(50)
      .execute(),
    countTable('sales_team_platforms'),
    countTable('warehouse_platforms'),
    countTable('order_website_owners'),
    countTable('woocommerce_stores'),
  ])

  return { rows, stats: { salesPlatforms, warehousePlatforms, websiteOwners, wooStores } }
})

export const listAdminStocks = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [rows, lots, movements, balances, warehouseStock, productOptions, warehouseOptions, userOptions] = await Promise.all([
    getDatabase()
      .selectFrom('stock_balances')
      .leftJoin('products', 'products.id', 'stock_balances.product_id')
      .leftJoin('warehouse_platforms', 'warehouse_platforms.id', 'stock_balances.warehouse_platform_id')
      .select([
        'stock_balances.id',
        'stock_balances.product_id',
        'stock_balances.owner_user_id',
        'stock_balances.warehouse_platform_id',
        'stock_balances.available_quantity',
        'stock_balances.committed_quantity',
        'stock_balances.reorder_level',
        'products.name as product_name',
        'products.sku_code',
        'warehouse_platforms.name as warehouse_name',
      ])
      .orderBy('stock_balances.updated_at', 'desc')
      .limit(50)
      .execute(),
    countTable('stock_lots'),
    countTable('stock_movements'),
    countTable('stock_balances'),
    countTable('stock_warehouses'),
    getDatabase().selectFrom('products').select(['id', 'name', 'sku_code']).orderBy('name').limit(400).execute(),
    getDatabase().selectFrom('warehouse_platforms').select(['id', 'name']).orderBy('name').execute(),
    getDatabase().selectFrom('app_users').select(['id', 'name', 'email']).orderBy('name').limit(400).execute(),
  ])

  return { rows, productOptions, warehouseOptions, userOptions, stats: { lots, movements, balances, warehouseStock } }
})

export const listAdminWarehouses = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  await requireAdmin()

  const [rows, warehousePlatforms, userRelations, warehouseStock, defaultRelations] = await Promise.all([
    getDatabase()
      .selectFrom('warehouse_platforms')
      .select(['id', 'name', 'order_prefix', 'stock_raw', 'stock_movement_raw', 'updated_at'])
      .orderBy('name')
      .limit(50)
      .execute(),
    countTable('warehouse_platforms'),
    countTable('warehouse_user_relations'),
    countTable('stock_warehouses'),
    getDatabase().selectFrom('warehouse_user_relations').select((eb) => eb.fn.countAll().as('count')).where('is_default', '=', true).executeTakeFirst(),
  ])

  return {
    rows,
    stats: {
      warehousePlatforms,
      userRelations,
      warehouseStock,
      defaultRelations: countValue(defaultRelations?.count),
    },
  }
})

export const saveAdminProduct = createServerFn({ method: 'POST' })
  .validator(productInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    const values = {
      name: data.name,
      sku_code: data.skuCode,
      manufacturer_barcode: data.manufacturerBarcode,
      category_id: data.categoryId,
      description: data.description,
      product_type: data.productType,
      shortform: data.shortform,
      supplier_name: data.supplierName,
      price_retail: data.priceRetail,
      price_distributor: data.priceDistributor,
      weight_g: data.weightG,
      length_cm: data.lengthCm,
      height_cm: data.heightCm,
      reorder_level: data.reorderLevel,
      status_ready: data.statusReady,
      credit_required: data.creditRequired,
      credit_value: data.creditValue,
      custom_bundle_price: data.customBundlePrice,
      hide_retail: data.hideRetail,
      hide_distributor: data.hideDistributor,
      updated_at: now,
    }

    const before = data.id
      ? await getDatabase().selectFrom('products').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('products').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('products').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()

    await auditAdminChange({ action: data.id ? 'admin.product.update' : 'admin.product.create', table: 'products', id: row.id, before, after: data })
    return row
  })

export const deleteAdminProduct = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('products').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('products').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.product.delete', table: 'products', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminUser = createServerFn({ method: 'POST' })
  .validator(userInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    const user = await requireAdmin()
    const now = new Date()
    const platformName = data.platformId
      ? (await getDatabase().selectFrom('sales_team_platforms').select('name').where('id', '=', data.platformId).executeTakeFirst())?.name ?? null
      : null
    const bunny = data.profileImage ? await import('./storage/bunny') : null
    const bunnyConfig = bunny ? bunny.getBunnyConfig() : null
    let profileImageFileId: string | null | undefined

    if (data.profileImage && bunny && bunnyConfig) {
      const safeFilename = data.profileImage.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `profile-images/${data.id ?? 'new'}/${Date.now()}-${randomUUID()}-${safeFilename}`
      const upload = await bunny.uploadToBunny({
        path,
        body: Buffer.from(data.profileImage.base64, 'base64'),
        contentType: data.profileImage.contentType,
      }, bunnyConfig)

      const file = await getDatabase()
        .insertInto('files')
        .values({
          storage_provider: 'bunny',
          storage_zone: bunnyConfig.storageZone,
          path: upload.path,
          public_url: upload.publicUrl,
          mime_type: data.profileImage.contentType,
          size_bytes: Buffer.byteLength(data.profileImage.base64, 'base64'),
          original_filename: data.profileImage.filename,
          uploaded_by_user_id: user.id,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow()

      profileImageFileId = file.id
    }
    const values = {
      name: data.name,
      email: data.email,
      phone: formatInternationalPhone(data.phone) || null,
      user_role: data.userRole,
      distributor_level: data.distributorLevel,
      platform_id: data.platformId,
      platform_sales_team: platformName,
      sales_team_location: data.salesTeamLocation,
      warehouse_relation_raw: data.warehouseNames.join(' , ') || null,
      ...(profileImageFileId ? { profile_image_file_id: profileImageFileId } : {}),
      updated_at: now,
    }
    const before = data.id
      ? await getDatabase().selectFrom('app_users').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('app_users').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('app_users').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
    const previousRelationName = before?.name ?? data.name
    await getDatabase()
      .deleteFrom('warehouse_user_relations')
      .where((eb) => eb.or([eb('user_name', '=', previousRelationName), eb('user_name', '=', data.name)]))
      .execute()
    if (data.warehouseNames.length > 0) {
      await getDatabase()
        .insertInto('warehouse_user_relations')
        .values(data.warehouseNames.map((warehouseName, index) => ({
          user_name: data.name,
          warehouse_name: warehouseName,
          is_default: index === 0,
          created_at: now,
          updated_at: now,
        })))
        .execute()
    }

    await auditAdminChange({ action: data.id ? 'admin.user.update' : 'admin.user.create', table: 'app_users', id: row.id, before, after: data })
    return row
  })

export const deleteAdminUser = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('app_users').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('app_users').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.user.delete', table: 'app_users', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminRole = createServerFn({ method: 'POST' })
  .validator(roleInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = data.id
      ? await getDatabase().selectFrom('roles').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const role = data.id
      ? await getDatabase().updateTable('roles').set({ name: data.name, description: data.description }).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('roles').values({ name: data.name, description: data.description }).returning(['id']).executeTakeFirstOrThrow()

    await getDatabase().deleteFrom('role_permissions').where('role_id', '=', role.id).execute()
    if (data.permissionIds.length) {
      await getDatabase()
        .insertInto('role_permissions')
        .values(data.permissionIds.map((permissionId) => ({ role_id: role.id, permission_id: permissionId })))
        .execute()
    }

    await auditAdminChange({ action: data.id ? 'admin.role.update' : 'admin.role.create', table: 'roles', id: role.id, before, after: data })
    return role
  })

export const deleteAdminRole = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('roles').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('roles').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.role.delete', table: 'roles', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminBundleLineItem = createServerFn({ method: 'POST' })
  .validator(bundleInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    const values = {
      bundle_product_id: data.bundleProductId,
      child_product_id: data.childProductId,
      bundle_product_code: data.bundleProductCode,
      product_code: data.productCode,
      product_category: data.productCategory,
      quantity: data.quantity,
      price_retail: data.priceRetail,
      price_distributor: data.priceDistributor,
      updated_at: now,
    }
    const before = data.id
      ? await getDatabase().selectFrom('bundle_line_items').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('bundle_line_items').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('bundle_line_items').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()

    await auditAdminChange({ action: data.id ? 'admin.bundle.update' : 'admin.bundle.create', table: 'bundle_line_items', id: row.id, before, after: data })
    return row
  })

export const saveAdminCreditRate = createServerFn({ method: 'POST' })
  .validator(creditRateInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    if (data.active) {
      await getDatabase().updateTable('product_credit_rates').set({ active: false, updated_at: now }).execute()
    }
    const before = data.id
      ? await getDatabase().selectFrom('product_credit_rates').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const values = { rate: data.rate, active: data.active, updated_at: now }
    const row = data.id
      ? await getDatabase().updateTable('product_credit_rates').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('product_credit_rates').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
    await auditAdminChange({ action: data.id ? 'admin.credit_rate.update' : 'admin.credit_rate.create', table: 'product_credit_rates', id: row.id, before, after: data })
    return row
  })

export const deleteAdminCreditRate = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('product_credit_rates').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('product_credit_rates').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.credit_rate.delete', table: 'product_credit_rates', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminProductPricing = createServerFn({ method: 'POST' })
  .validator(productPricingInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('products').selectAll().where('id', '=', data.id).executeTakeFirst()
    const row = await getDatabase()
      .updateTable('products')
      .set({
        price_retail: data.priceRetail,
        price_distributor: data.priceDistributor,
        custom_bundle_price: data.customBundlePrice,
        credit_required: data.creditRequired,
        credit_value: data.creditValue,
        hide_retail: data.hideRetail,
        hide_distributor: data.hideDistributor,
        updated_at: new Date(),
      })
      .where('id', '=', data.id)
      .returning(['id'])
      .executeTakeFirstOrThrow()
    await auditAdminChange({ action: 'admin.product_pricing.update', table: 'products', id: row.id, before, after: data })
    return row
  })

export const saveAdminShippingZone = createServerFn({ method: 'POST' })
  .validator(shippingZoneInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    const values = {
      zone_name: data.zoneName,
      active: data.active,
      apply_all_product: data.applyAllProduct,
      country_legacy_id: data.countryLegacyId,
      apply_products_raw: data.applyProductsRaw,
      states_raw: data.statesRaw,
      shipping_rate_raw: data.shippingRateRaw,
      shipping_cod_rate_raw: data.shippingCodRateRaw,
      updated_at: now,
    }
    const before = data.id
      ? await getDatabase().selectFrom('shipping_zones').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('shipping_zones').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('shipping_zones').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
    await auditAdminChange({ action: data.id ? 'admin.shipping_zone.update' : 'admin.shipping_zone.create', table: 'shipping_zones', id: row.id, before, after: data })
    return row
  })

export const deleteAdminShippingZone = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('shipping_zones').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('shipping_zones').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.shipping_zone.delete', table: 'shipping_zones', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminCourier = createServerFn({ method: 'POST' })
  .validator(courierInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    const values = { name: data.name, tracking_url: data.trackingUrl, legacy_slug: data.legacySlug, updated_at: now }
    const before = data.id
      ? await getDatabase().selectFrom('shipping_couriers').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('shipping_couriers').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('shipping_couriers').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
    await auditAdminChange({ action: data.id ? 'admin.courier.update' : 'admin.courier.create', table: 'shipping_couriers', id: row.id, before, after: data })
    return row
  })

export const deleteAdminCourier = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('shipping_couriers').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('shipping_couriers').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.courier.delete', table: 'shipping_couriers', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminSalesPlatform = createServerFn({ method: 'POST' })
  .validator(salesPlatformInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    const values = {
      name: data.name,
      order_prefix: data.orderPrefix,
      platform_category: data.platformCategory,
      finance_approval_active: data.financeApprovalActive,
      order_min_limit_approval: data.orderMinLimitApproval,
      url: data.url,
      updated_at: now,
    }
    const before = data.id
      ? await getDatabase().selectFrom('sales_team_platforms').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('sales_team_platforms').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('sales_team_platforms').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
    await auditAdminChange({ action: data.id ? 'admin.sales_platform.update' : 'admin.sales_platform.create', table: 'sales_team_platforms', id: row.id, before, after: data })
    return row
  })

export const deleteAdminSalesPlatform = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('sales_team_platforms').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('sales_team_platforms').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.sales_platform.delete', table: 'sales_team_platforms', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminWarehousePlatform = createServerFn({ method: 'POST' })
  .validator(warehousePlatformInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    const values = {
      name: data.name,
      order_prefix: data.orderPrefix,
      stock_raw: data.stockRaw,
      stock_movement_raw: data.stockMovementRaw,
      updated_at: now,
    }
    const before = data.id
      ? await getDatabase().selectFrom('warehouse_platforms').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('warehouse_platforms').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('warehouse_platforms').values({ ...values, created_at: now }).returning(['id']).executeTakeFirstOrThrow()
    await auditAdminChange({ action: data.id ? 'admin.warehouse_platform.update' : 'admin.warehouse_platform.create', table: 'warehouse_platforms', id: row.id, before, after: data })
    return row
  })

export const deleteAdminWarehousePlatform = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('warehouse_platforms').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('warehouse_platforms').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.warehouse_platform.delete', table: 'warehouse_platforms', id: data.id, before })
    return { id: data.id }
  })

export const saveAdminStockBalance = createServerFn({ method: 'POST' })
  .validator(stockBalanceInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const now = new Date()
    const values = {
      product_id: data.productId,
      owner_user_id: data.ownerUserId,
      warehouse_platform_id: data.warehousePlatformId,
      available_quantity: data.availableQuantity,
      committed_quantity: data.committedQuantity,
      reorder_level: data.reorderLevel,
      updated_at: now,
    }
    const before = data.id
      ? await getDatabase().selectFrom('stock_balances').selectAll().where('id', '=', data.id).executeTakeFirst()
      : null
    const row = data.id
      ? await getDatabase().updateTable('stock_balances').set(values).where('id', '=', data.id).returning(['id']).executeTakeFirstOrThrow()
      : await getDatabase().insertInto('stock_balances').values(values).returning(['id']).executeTakeFirstOrThrow()
    await auditAdminChange({ action: data.id ? 'admin.stock_balance.update' : 'admin.stock_balance.create', table: 'stock_balances', id: row.id, before, after: data })
    return row
  })

export const deleteAdminStockBalance = createServerFn({ method: 'POST' })
  .validator(deleteInput)
  .handler(async ({ data }) => {
    const { getDatabase } = await getAdminDeps()
    await requireAdmin()
    const before = await getDatabase().selectFrom('stock_balances').selectAll().where('id', '=', data.id).executeTakeFirst()
    await getDatabase().deleteFrom('stock_balances').where('id', '=', data.id).execute()
    await auditAdminChange({ action: 'admin.stock_balance.delete', table: 'stock_balances', id: data.id, before })
    return { id: data.id }
  })
