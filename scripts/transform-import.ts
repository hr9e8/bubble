import { createHash } from 'node:crypto'
import process from 'node:process'
import { Pool, type PoolClient } from 'pg'
import { loadLocalEnv } from './load-env'

loadLocalEnv()

type RawRow = {
  row_index: number
  source_file: string
  legacy_bubble_id: string | null
  legacy_slug: string | null
  raw_data: Record<string, string>
}

type InsertRow = Record<string, unknown>

const batchArg = process.argv.find((arg) => arg.startsWith('--batch='))
const requestedBatchId = batchArg?.slice('--batch='.length)

const canonicalFiles = {
  products: 'data-example-2/Products-modified-copied.csv',
  orders: 'data-example-2/Orders-Column.csv',
}

const managedTables = [
  'order_items',
  'order_payment_proofs',
  'payment_proofs',
  'payment_verifications',
  'warehouse_events',
  'order_notes',
  'order_tags',
  'stock_movements',
  'stock_lots',
  'stock_warehouses',
  'stock_balances',
  'orders',
  'woocommerce_sync_jobs',
  'woocommerce_webhook_events',
  'woocommerce_stores',
  'customers',
  'bundle_line_items',
  'shipping_zone_products',
  'products',
  'product_categories',
  'shipping_accounts',
  'shipping_rates',
  'shipping_cod_rates',
  'shipping_zones',
  'shipping_states',
  'shipping_countries',
  'shipping_couriers',
  'warehouse_user_relations',
  'sales_team_platforms',
  'warehouse_platforms',
  'app_users',
]

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required to transform import data.')
}

const pool = new Pool({ connectionString })

function clean(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function numberValue(value: unknown, fallback = 0) {
  const text = clean(value)
  if (!text) return fallback

  const parsed = Number(text.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function integerValue(value: unknown, fallback = 0) {
  return Math.trunc(numberValue(value, fallback))
}

function booleanValue(value: unknown, fallback: boolean | null = null) {
  const text = clean(value)?.toLowerCase()
  if (!text) return fallback
  if (['yes', 'true', '1', 'active'].includes(text)) return true
  if (['no', 'false', '0', 'inactive'].includes(text)) return false
  return fallback
}

function dateValue(value: unknown) {
  const text = clean(value)
  if (!text) return null

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function hashId(prefix: string, value: string) {
  return `${prefix}:${createHash('sha1').update(value).digest('hex').slice(0, 24)}`
}

function normalizedKey(...parts: Array<unknown>) {
  return parts
    .map((part) => clean(part)?.toLowerCase().replace(/\s+/g, ' ') ?? '')
    .join('|')
}

function customerKey(row: Record<string, string>) {
  const name = clean(row.Name ?? row['Customer Name']) ?? 'unknown'
  const email = clean(row.Email ?? row['Customer Email'])
  const phone = clean(row.Phone ?? row['Customer Phone Number'])

  if (email) return normalizedKey('email', email, name)
  if (phone) return normalizedKey('phone', phone, name)

  return normalizedKey(
    'address',
    name,
    row['Address Line'] ?? row.Address,
    row.City ?? row['Customer City'],
    row.State ?? row['Customer State'],
    row['Zip Code'] ?? row['Customer Zip Code'],
  )
}

function orderStatus(row: Record<string, string>) {
  const fulfillment = clean(row['Fulfilment Status'])?.toLowerCase()
  const payment = clean(row['Payment Status'])?.toLowerCase()
  const financeHold = booleanValue(row.FinanceHoldOrder, false)

  if (financeHold) return 'finance_hold'
  if (fulfillment === 'shipped') return 'shipped'
  if (fulfillment === 'packing' || fulfillment === 'packed') return 'packing'
  if (payment === 'verified') return 'verified'
  if (payment) return 'pending_payment'
  return 'draft'
}

function signedMovementQuantity(row: Record<string, string>) {
  const quantity = integerValue(row.Quantity)
  const movementType = clean(row['Movement Type'])?.toLowerCase() ?? ''

  if (/\b(out|reserve|deduct|sold)\b/.test(movementType)) {
    return -Math.abs(quantity)
  }

  return quantity
}

function placeholders(start: number, rows: number, columns: number) {
  return Array.from({ length: rows }, (_, rowIndex) => {
    const offset = start + rowIndex * columns
    return `(${Array.from({ length: columns }, (_, columnIndex) => `$${offset + columnIndex}`).join(', ')})`
  }).join(', ')
}

async function canonicalRows(client: PoolClient, batchId: string, entityName: string, sourceFile?: string) {
  const params: Array<unknown> = [batchId, entityName]
  let sourceClause = ''

  if (sourceFile) {
    params.push(sourceFile)
    sourceClause = ` and (source_file = $${params.length} or source_variant = 'modified')`
  }

  const result = await client.query<RawRow>(
    `select row_index, source_file, legacy_bubble_id, legacy_slug, raw_data
     from bubble_import_rows
     where batch_id = $1
       and entity_name = $2
       and source_variant in ('canonical', 'modified')
       ${sourceClause}
     order by case source_variant when 'canonical' then 0 else 1 end, row_index`,
    params,
  )

  const merged = new Map<string, RawRow>()
  for (const row of result.rows) {
    const orderNumber = clean(row.raw_data['Order ID'] ?? row.raw_data.Order)
    const sku = clean(row.raw_data['SKU Code'] ?? row.raw_data.Product ?? row.raw_data['Product Data'])
    const key = row.legacy_bubble_id ?? orderNumber ?? sku ?? `${row.source_file}:${row.row_index}`
    merged.set(`${entityName}:${key}`, row)
  }

  return Array.from(merged.values()).sort((a, b) => a.row_index - b.row_index)
}

async function insertRows<T extends Record<string, unknown>>(
  client: PoolClient,
  table: string,
  rows: Array<InsertRow>,
  returning = '',
) {
  if (rows.length === 0) return [] as Array<T>

  const columns = Object.keys(rows[0])
  const returned: Array<T> = []

  for (let start = 0; start < rows.length; start += 500) {
    const chunk = rows.slice(start, start + 500)
    const values: Array<unknown> = []

    for (const row of chunk) {
      for (const column of columns) {
        values.push(row[column])
      }
    }

    const result = await client.query<T>(
      `insert into ${table} (${columns.join(', ')})
       values ${placeholders(1, chunk.length, columns.length)}
       ${returning ? `returning ${returning}` : ''}`,
      values,
    )

    returned.push(...result.rows)
  }

  return returned
}

async function latestBatchId(client: PoolClient) {
  if (requestedBatchId) return requestedBatchId

  const result = await client.query<{ id: string }>(
    'select id from bubble_import_batches order by created_at desc limit 1',
  )

  const id = result.rows[0]?.id
  if (!id) throw new Error('No Bubble import batches found.')
  return id
}

async function resetManagedTables(client: PoolClient) {
  await client.query('alter table if exists stock_movements disable trigger stock_movements_no_delete')
  try {
    for (const table of managedTables) {
      await client.query(`delete from ${table}`)
    }
  } finally {
    await client.query('alter table if exists stock_movements enable trigger stock_movements_no_delete')
  }
}

async function writeReconciliationReports(client: PoolClient, batchId: string, skipped: Record<string, number>) {
  await client.query('delete from migration_reconciliation_reports where batch_id = $1', [batchId])

  const entityCounts = await client.query(
    `with source_counts as (
       select entity_name, count(*)::int source_count
       from bubble_import_rows
       where batch_id = $1 and source_variant in ('canonical', 'modified')
       group by entity_name
     ), target_counts as (
       select 'app_users' entity_name, count(*)::int target_count from app_users
       union all select 'products', count(*)::int from products
       union all select 'customers', count(*)::int from customers
       union all select 'orders', count(*)::int from orders
       union all select 'order_items', count(*)::int from order_items
       union all select 'stock_lots', count(*)::int from stock_lots
       union all select 'stock_movements', count(*)::int from stock_movements
     )
     select coalesce(source_counts.entity_name, target_counts.entity_name) entity_name,
            coalesce(source_count, 0) source_count,
            coalesce(target_count, 0) target_count,
            coalesce(source_count, 0) - coalesce(target_count, 0) delta
     from source_counts
     full join target_counts using (entity_name)
     order by entity_name`,
    [batchId],
  )

  const totalMismatches = await client.query(
    `select orders.order_number,
            orders.total_amount::numeric transformed_total,
            nullif(regexp_replace(rows.raw_data->>'Total Amount', '[^0-9.-]', '', 'g'), '')::numeric source_total
     from orders
     join bubble_import_rows rows on rows.batch_id = $1
      and rows.entity_name = 'orders'
      and rows.raw_data->>'Order ID' = orders.order_number
     where abs(coalesce(orders.total_amount::numeric, 0) - coalesce(nullif(regexp_replace(rows.raw_data->>'Total Amount', '[^0-9.-]', '', 'g'), '')::numeric, 0)) > 0.01
     limit 100`,
    [batchId],
  )

  const orphanChecks = await client.query(
    `select 'order_items_missing_order' check_name, count(*)::int count from order_items left join orders on orders.id = order_items.order_id where orders.id is null
     union all select 'orders_missing_customer', count(*)::int from orders where customer_id is not null and not exists (select 1 from customers where customers.id = orders.customer_id)
     union all select 'stock_movements_missing_product', count(*)::int from stock_movements left join products on products.id = stock_movements.product_id where products.id is null
     union all select 'unresolved_import_relationships', count(*)::int from bubble_import_relationships where batch_id = $1 and resolved_id is null`,
    [batchId],
  )

  const stockMismatches = await client.query(
    `with lot_balances as (
       select product_id, owner_user_id, warehouse_platform_id, sum(quantity_initial)::numeric expected_quantity
       from stock_lots
       group by product_id, owner_user_id, warehouse_platform_id
     )
     select products.sku_code,
            lot_balances.owner_user_id,
            lot_balances.expected_quantity,
            coalesce(stock_balance_ledger.available_quantity::numeric, 0) ledger_quantity
     from lot_balances
     left join stock_balance_ledger using (product_id, owner_user_id, warehouse_platform_id)
     left join products on products.id = lot_balances.product_id
     where lot_balances.expected_quantity <> coalesce(stock_balance_ledger.available_quantity::numeric, 0)
     limit 100`,
  )

  const paymentComparisons = await client.query(
    `select orders.order_number,
            orders.payment_status transformed_payment_status,
            rows.raw_data->>'Payment Status' source_payment_status
     from orders
     join bubble_import_rows rows on rows.batch_id = $1
      and rows.entity_name = 'orders'
      and rows.raw_data->>'Order ID' = orders.order_number
     where coalesce(lower(orders.payment_status), '') <> coalesce(lower(rows.raw_data->>'Payment Status'), '')
     limit 100`,
    [batchId],
  )

  const reports = [
    { report_type: 'entity_counts', detail: entityCounts.rows, summary: { mismatches: entityCounts.rows.filter((row: { delta: number }) => row.delta !== 0).length } },
    { report_type: 'total_mismatches', detail: totalMismatches.rows, summary: { mismatches: totalMismatches.rowCount } },
    { report_type: 'orphan_checks', detail: orphanChecks.rows, summary: { mismatches: orphanChecks.rows.reduce((sum: number, row: { count: number }) => sum + row.count, 0) } },
    { report_type: 'stock_mismatches', detail: stockMismatches.rows, summary: { mismatches: stockMismatches.rowCount } },
    { report_type: 'payment_status_comparisons', detail: paymentComparisons.rows, summary: { mismatches: paymentComparisons.rowCount } },
    { report_type: 'skipped_rows', detail: [skipped], summary: skipped },
  ]

  for (const report of reports) {
    await client.query(
      `insert into migration_reconciliation_reports (batch_id, report_type, status, summary, detail)
       values ($1, $2, $3, $4, $5)`,
      [
        batchId,
        report.report_type,
        Number(report.summary.mismatches ?? 0) === 0 ? 'closed' : 'open',
        JSON.stringify(report.summary),
        JSON.stringify(report.detail),
      ],
    )
  }
}

async function transform(client: PoolClient, batchId: string) {
  const skipped = {
    duplicateOrders: 0,
    orderItemsMissingOrder: 0,
    stockLotsMissingProduct: 0,
    stockMovementsMissingProduct: 0,
    stockMovementsZeroQuantity: 0,
  }

  await resetManagedTables(client)

  const userRows = await canonicalRows(client, batchId, 'users')
  await insertRows(client, 'app_users', userRows.map(({ legacy_bubble_id, raw_data }) => ({
    auth_user_id: null,
    legacy_bubble_id,
    name: clean(raw_data.Name) ?? 'Unnamed user',
    username: clean(raw_data.username),
    email: clean(raw_data.email),
    phone: clean(raw_data.Phone),
    user_role: clean(raw_data['User Role']),
    platform_sales_team: clean(raw_data['Platform Sales Team']),
    sales_team_location: clean(raw_data['Sales Team Location']),
    warehouse_relation_raw: clean(raw_data['Warehouse Relation']),
    created_at: dateValue(raw_data['Creation Date']),
  })))

  const salesPlatformRows = await canonicalRows(client, batchId, 'sales_team_platforms')
  const insertedSalesPlatforms = await insertRows<{ id: string; name: string }>(
    client,
    'sales_team_platforms',
    salesPlatformRows.map(({ legacy_bubble_id, raw_data }) => ({
      legacy_bubble_id,
      name: clean(raw_data.Name) ?? 'Unnamed platform',
      order_prefix: clean(raw_data['Order Prefix']),
      platform_category: clean(raw_data['Platform Category']),
      finance_approval_active: booleanValue(raw_data['Finance Approval Active']),
      order_min_limit_approval: clean(raw_data['Order Min Limit Approval']) ? numberValue(raw_data['Order Min Limit Approval']) : null,
      url: clean(raw_data.Url),
      stock_raw: clean(raw_data.Stock),
      created_at: dateValue(raw_data['Creation Date']),
    })),
    'id, name',
  )
  const salesPlatformByName = new Map(insertedSalesPlatforms.map((row) => [normalizedKey(row.name), row.id]))

  const warehouseRows = await canonicalRows(client, batchId, 'warehouse_platforms')
  const insertedWarehouses = await insertRows<{ id: string; name: string }>(
    client,
    'warehouse_platforms',
    warehouseRows.map(({ legacy_bubble_id, raw_data }) => ({
      legacy_bubble_id,
      name: clean(raw_data.Name) ?? 'Unnamed warehouse',
      order_prefix: clean(raw_data['Order Prefix']),
      stock_raw: clean(raw_data.Stock),
      stock_movement_raw: clean(raw_data['Stock Movement']),
      created_at: dateValue(raw_data['Creation Date']),
    })),
    'id, name',
  )
  const warehouseByName = new Map(insertedWarehouses.map((row) => [normalizedKey(row.name), row.id]))

  const warehouseRelationRows = await canonicalRows(client, batchId, 'warehouse_user_relations')
  await insertRows(client, 'warehouse_user_relations', warehouseRelationRows.map(({ legacy_slug, raw_data }) => ({
    user_name: clean(raw_data.User),
    warehouse_name: clean(raw_data.warehouse) ?? 'Unknown warehouse',
    is_default: booleanValue(raw_data.Default),
    legacy_slug,
    created_by: clean(raw_data.Creator),
    created_at: dateValue(raw_data['Creation Date']),
    updated_at: dateValue(raw_data['Modified Date']),
  })))

  const categoryRows = new Map<string, InsertRow>()
  const productRows = await canonicalRows(client, batchId, 'products', canonicalFiles.products)
  for (const { raw_data } of productRows) {
    const category = clean(raw_data.Category)
    if (!category) continue
    const key = normalizedKey(category)
    categoryRows.set(key, {
      legacy_bubble_id: hashId('category', key),
      legacy_slug: key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: category,
      description: null,
      created_by_user_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  const insertedCategories = await insertRows<{ id: string; name: string }>(
    client,
    'product_categories',
    Array.from(categoryRows.values()),
    'id, name',
  )
  const categoryByName = new Map(insertedCategories.map((row) => [normalizedKey(row.name), row.id]))

  const insertedProducts = await insertRows<{ id: string; sku_code: string | null; legacy_bubble_id: string | null }>(
    client,
    'products',
    productRows.map(({ legacy_bubble_id, raw_data }) => ({
      legacy_bubble_id,
      legacy_slug: null,
      category_id: categoryByName.get(normalizedKey(raw_data.Category)) ?? null,
      name: clean(raw_data.Name) ?? clean(raw_data['SKU Code']) ?? 'Unnamed product',
      description: clean(raw_data.Description ?? raw_data.Remarks),
      sku_code: clean(raw_data['SKU Code']),
      manufacturer_barcode: clean(raw_data['Manufacturer Barcode']),
      price_retail: numberValue(raw_data['Price Retail']),
      price_distributor: numberValue(raw_data['Price Distributor']),
      weight_g: clean(raw_data['Weight (g)']) ? integerValue(raw_data['Weight (g)']) : null,
      reorder_level: clean(raw_data['Reorder Level']) ? integerValue(raw_data['Reorder Level']) : null,
      status_ready: booleanValue(raw_data['Status Ready?'], true),
      image_file_id: null,
      created_by_user_id: clean(raw_data.Creator),
      created_at: dateValue(raw_data['Creation Date']) ?? new Date(),
      updated_at: new Date(),
    })),
    'id, sku_code, legacy_bubble_id',
  )
  const productBySku = new Map(insertedProducts.filter((row) => row.sku_code).map((row) => [normalizedKey(row.sku_code), row.id]))

  const countryRows = await canonicalRows(client, batchId, 'shipping_countries')
  await insertRows(client, 'shipping_countries', countryRows.map(({ legacy_bubble_id, raw_data }) => ({
    legacy_bubble_id,
    name: clean(raw_data.Name) ?? 'Unnamed country',
    country_code: clean(raw_data['Country Code']),
    currency: clean(raw_data.Currency),
    lhdn_code: clean(raw_data['LHDN Code']),
    phone_prefix: clean(raw_data['Phone Prefix']),
    shipping_states_raw: clean(raw_data['Shipping States']),
    created_at: dateValue(raw_data['Creation Date']),
  })))

  const stateRows = await canonicalRows(client, batchId, 'shipping_states')
  await insertRows(client, 'shipping_states', stateRows.map(({ legacy_bubble_id, legacy_slug, raw_data }) => ({
    legacy_bubble_id,
    country_legacy_id: clean(raw_data['Shipping Country']),
    name: clean(raw_data.Name) ?? 'Unnamed state',
    shortform: clean(raw_data.Shortform),
    lhdn_code: clean(raw_data['LHDN Code']),
    legacy_slug,
    created_at: dateValue(raw_data['Creation Date']),
    updated_at: dateValue(raw_data['Modified Date']),
  })))

  const courierRows = await canonicalRows(client, batchId, 'shipping_couriers')
  await insertRows(client, 'shipping_couriers', courierRows.map(({ legacy_bubble_id, legacy_slug, raw_data }) => ({
    legacy_bubble_id,
    name: clean(raw_data.Name) ?? 'Unnamed courier',
    tracking_url: clean(raw_data['Tracking URL']),
    legacy_slug,
    created_by: clean(raw_data.Creator),
    created_at: dateValue(raw_data['Creation Date']),
    updated_at: dateValue(raw_data['Modified Date']),
  })))

  const zoneRows = await canonicalRows(client, batchId, 'shipping_zones')
  await insertRows(client, 'shipping_zones', zoneRows.map(({ legacy_bubble_id, raw_data }) => ({
    legacy_bubble_id,
    zone_name: clean(raw_data['Zone Name']) ?? 'Unnamed zone',
    active: booleanValue(raw_data['Active?']),
    apply_all_product: booleanValue(raw_data.ApplyAllProduct),
    country_legacy_id: clean(raw_data.Country),
    apply_products_raw: clean(raw_data['Apply Products']),
    states_raw: clean(raw_data.States),
    shipping_rate_raw: clean(raw_data['Shipping Rate']),
    shipping_cod_rate_raw: clean(raw_data['Shipping COD Rate']),
    created_by: clean(raw_data.Creator),
    created_at: dateValue(raw_data['Creation Date']),
  })))

  const rateRows = await canonicalRows(client, batchId, 'shipping_rates')
  await insertRows(client, 'shipping_rates', rateRows.map(({ legacy_bubble_id, raw_data }) => ({
    legacy_bubble_id,
    name: clean(raw_data.Name) ?? 'Unnamed shipping rate',
    active: booleanValue(raw_data['Active?']),
    cod: booleanValue(raw_data['COD?']),
    shipping_price: numberValue(raw_data['Shipping Price']),
    shipping_type: clean(raw_data['Shipping Type']),
    shipping_zone_legacy_id: clean(raw_data['Shipping Zone']),
    total_min: clean(raw_data.TotalMin) ? numberValue(raw_data.TotalMin) : null,
    total_max: clean(raw_data.TotalMax) ? numberValue(raw_data.TotalMax) : null,
    total_range: clean(raw_data.TotalRange),
    weight_min_kg: clean(raw_data['WeightMin (kg)']) ? numberValue(raw_data['WeightMin (kg)']) : null,
    weight_max_kg: clean(raw_data['WeightMax(kg)']) ? numberValue(raw_data['WeightMax(kg)']) : null,
    weight_range_kg: clean(raw_data['WeightRange(kg)']),
    created_by: clean(raw_data.Creator),
    created_at: dateValue(raw_data['Creation Date']),
  })))

  const codRateRows = await canonicalRows(client, batchId, 'shipping_cod_rates')
  await insertRows(client, 'shipping_cod_rates', codRateRows.map(({ legacy_bubble_id, raw_data }) => ({
    legacy_bubble_id,
    name: clean(raw_data.Name) ?? 'Unnamed COD rate',
    cod_price: numberValue(raw_data['COD Price']),
    shipping_type: clean(raw_data['Shipping Type']),
    shipping_zone_legacy_id: clean(raw_data['Shipping Zone']),
    total_min: clean(raw_data.TotalMin) ? numberValue(raw_data.TotalMin) : null,
    total_max: clean(raw_data.TotalMax) ? numberValue(raw_data.TotalMax) : null,
    total_range: clean(raw_data.TotalRange),
    weight_min_kg: clean(raw_data['WeightMin (kg)']) ? numberValue(raw_data['WeightMin (kg)']) : null,
    weight_max_kg: clean(raw_data['WeightMax(kg)']) ? numberValue(raw_data['WeightMax(kg)']) : null,
    weight_range: clean(raw_data.WeightRange),
    created_by: clean(raw_data.Creator),
    created_at: dateValue(raw_data['Creation Date']),
  })))

  const accountRows = await canonicalRows(client, batchId, 'shipping_accounts')
  await insertRows(client, 'shipping_accounts', accountRows.map(({ raw_data }) => ({
    sold_to_account_id: clean(raw_data.soldToAccountId),
    pickup_account_id: clean(raw_data.pickupAccountId),
    id_name: clean(raw_data.IDName),
    courier_name: clean(raw_data.Courier),
    courier_data_raw: clean(raw_data.CourierData),
    company: clean(raw_data.Company),
    name: clean(raw_data.Name),
    email: clean(raw_data.Email),
    phone_number: clean(raw_data['Phone Number']),
    address_line_1: clean(raw_data['Address Line 1']),
    address_line_2: clean(raw_data['Address Line 2']),
    city: clean(raw_data.City),
    state: clean(raw_data.State),
    country: clean(raw_data.Country),
    zipcode: clean(raw_data.Zipcode),
    user_name: clean(raw_data.User),
    prefix: clean(raw_data.Prefix),
    created_at: dateValue(raw_data['Creation Date']),
  })))

  const customerSourceRows = await canonicalRows(client, batchId, 'customers')
  const orderRows = await canonicalRows(client, batchId, 'orders', canonicalFiles.orders)
  const customerRecords = new Map<string, InsertRow>()

  for (const { legacy_bubble_id, legacy_slug, raw_data } of customerSourceRows) {
    const key = customerKey(raw_data)
    customerRecords.set(key, {
      legacy_bubble_id: legacy_bubble_id ?? hashId('customer', key),
      legacy_slug,
      seller_user_id: null,
      name: clean(raw_data.Name) ?? 'Unnamed customer',
      email: clean(raw_data.Email),
      phone: clean(raw_data.Phone),
      address_line: clean(raw_data['Address Line']),
      city: clean(raw_data.City),
      state: clean(raw_data.State),
      country: clean(raw_data.CountryRelated),
      zip_code: clean(raw_data['Zip Code']),
      note: clean(raw_data.Note),
      created_by_user_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  for (const { legacy_bubble_id, legacy_slug, raw_data } of orderRows) {
    const key = customerKey(raw_data)
    const existing = customerRecords.get(key)
    customerRecords.set(key, {
      legacy_bubble_id: existing?.legacy_bubble_id ?? legacy_bubble_id ?? hashId('customer', key),
      legacy_slug: existing?.legacy_slug ?? legacy_slug,
      seller_user_id: existing?.seller_user_id ?? clean(raw_data.CreatedBy),
      name: existing?.name ?? clean(raw_data['Customer Name']) ?? 'Unnamed customer',
      email: existing?.email ?? clean(raw_data['Customer Email']),
      phone: existing?.phone ?? clean(raw_data['Customer Phone Number']),
      address_line: existing?.address_line ?? clean(raw_data['Customer Address'] ?? raw_data['Address Line']),
      city: existing?.city ?? clean(raw_data['Customer City']),
      state: existing?.state ?? clean(raw_data['Customer State']),
      country: existing?.country ?? clean(raw_data['Customer Country']),
      zip_code: existing?.zip_code ?? clean(raw_data['Customer Zip Code']),
      note: existing?.note ?? null,
      created_by_user_id: existing?.created_by_user_id ?? clean(raw_data.Creator),
      created_at: existing?.created_at ?? dateValue(raw_data['Creation Date']) ?? new Date(),
      updated_at: new Date(),
    })
  }

  const insertedCustomers = await insertRows<{ id: string; legacy_bubble_id: string }>(
    client,
    'customers',
    Array.from(customerRecords.values()),
    'id, legacy_bubble_id',
  )
  const customerByLegacyId = new Map(insertedCustomers.map((row) => [row.legacy_bubble_id, row.id]))

  const normalizedOrders = new Map<string, InsertRow>()
  for (const { legacy_bubble_id, legacy_slug, raw_data } of orderRows) {
    const orderNumber = clean(raw_data['Order ID'])
    if (!orderNumber) continue

    const normalizedOrderKey = normalizedKey(orderNumber)
    if (normalizedOrders.has(normalizedOrderKey)) {
      skipped.duplicateOrders += 1
      continue
    }

    const key = customerKey(raw_data)
    normalizedOrders.set(normalizedOrderKey, {
      legacy_bubble_id,
      legacy_slug,
      order_number: orderNumber,
      seller_user_id: clean(raw_data.CreatedBy),
      customer_id: customerByLegacyId.get(hashId('customer', key)) ?? null,
      platform_id: salesPlatformByName.get(normalizedKey(raw_data.Platform)) ?? null,
      warehouse_platform_id: null,
      order_status: orderStatus(raw_data),
      fulfillment_status: clean(raw_data['Fulfilment Status']),
      payment_status: clean(raw_data['Payment Status']),
      payment_method: clean(raw_data['Payment Method']),
      currency: clean(raw_data['Customer Country']) === 'Singapore' ? 'SGD' : 'MYR',
      subtotal_amount: numberValue(raw_data['Subtotal Amount']),
      shipping_total: numberValue(raw_data['Shipping Total']),
      transaction_fee: 0,
      total_amount: numberValue(raw_data['Total Amount']),
      tracking_courier: clean(raw_data['Tracking Courier']),
      tracking_number: clean(raw_data['Tracking Number']),
      tracking_url: clean(raw_data['Tracking URL']),
      shipped_at: null,
      created_by_user_id: clean(raw_data.Creator),
      created_at: dateValue(raw_data['Creation Date']) ?? new Date(),
      updated_at: new Date(),
    })
  }

  const insertedOrders = await insertRows<{ id: string; order_number: string }>(
    client,
    'orders',
    Array.from(normalizedOrders.values()),
    'id, order_number',
  )
  const orderByNumber = new Map(insertedOrders.map((row) => [normalizedKey(row.order_number), row.id]))

  const itemRows = await canonicalRows(client, batchId, 'order_line_items')
  const orderItemInserts: Array<InsertRow> = []
  for (const { row_index, legacy_bubble_id, legacy_slug, raw_data } of itemRows) {
    const orderId = orderByNumber.get(normalizedKey(raw_data.Order))
    if (!orderId) {
      skipped.orderItemsMissingOrder += 1
      continue
    }

    const quantity = integerValue(raw_data.Quantity, 1)
    const orderPrice = numberValue(raw_data['Order Price'])
    orderItemInserts.push({
      legacy_bubble_id: legacy_bubble_id ?? `order-line:${row_index}`,
      legacy_slug,
      order_id: orderId,
      product_id: productBySku.get(normalizedKey(raw_data.Product)) ?? null,
      bundle_parent_id: productBySku.get(normalizedKey(raw_data.BundleParent)) ?? null,
      quantity,
      order_price: orderPrice,
      order_line_total: orderPrice * quantity,
      fulfillment_status: clean(raw_data['Fulfillment Status']),
      created_by_user_id: clean(raw_data.OrderDistributor),
      created_at: new Date(),
      updated_at: new Date(),
    })
  }
  await insertRows(client, 'order_items', orderItemInserts)

  const stockRows = await canonicalRows(client, batchId, 'stocks')
  const stockLotInserts: Array<InsertRow> = []
  const stockMovementInsertsFromLots: Array<InsertRow> = []

  for (const { row_index, legacy_bubble_id, legacy_slug, raw_data } of stockRows) {
    const productId = productBySku.get(normalizedKey(raw_data.Product))
    if (!productId) {
      skipped.stockLotsMissingProduct += 1
      continue
    }

    const owner = clean(raw_data['Owner/Receiver'])
    const warehouseId = warehouseByName.get(normalizedKey(raw_data['Warehouse Platform'])) ?? null
    const quantity = integerValue(raw_data['Available Quantity'])

    stockLotInserts.push({
      legacy_bubble_id: legacy_bubble_id ?? `stock:${row_index}`,
      legacy_slug,
      product_id: productId,
      owner_user_id: owner,
      warehouse_platform_id: warehouseId,
      location: clean(raw_data.Location),
      quantity_initial: quantity,
      sellable_status: clean(raw_data['Stock Type']),
      date_received: dateValue(raw_data['Creation Date']),
      do_number: null,
      inbound_number: null,
      created_by_user_id: clean(raw_data.Creator),
      created_at: dateValue(raw_data['Creation Date']) ?? new Date(),
      updated_at: new Date(),
    })

    if (quantity === 0) {
      skipped.stockMovementsZeroQuantity += 1
    } else {
      stockMovementInsertsFromLots.push({
        legacy_bubble_id: legacy_bubble_id ? `${legacy_bubble_id}:opening` : `stock:${row_index}:opening`,
        legacy_slug,
        movement_type: 'opening_balance',
        product_id: productId,
        order_id: null,
        user_related_id: owner,
        warehouse_platform_id: warehouseId,
        quantity,
        remark: 'Opening balance derived from Bubble Stocks export',
        created_by_user_id: clean(raw_data.Creator),
        created_at: dateValue(raw_data['Creation Date']) ?? new Date(),
        updated_at: new Date(),
      })
    }
  }

  await insertRows(client, 'stock_lots', stockLotInserts)

  const stockWarehouseRows = await canonicalRows(client, batchId, 'stock_warehouses')
  await insertRows(client, 'stock_warehouses', stockWarehouseRows.map(({ raw_data }) => ({
    product_code: clean(raw_data.Product) ?? 'UNKNOWN',
    warehouse_platform_name: clean(raw_data['Warehouse Platform']) ?? 'Unknown warehouse',
    warehouse_stock_type: clean(raw_data['Warehouse Stock type']),
    quantity: integerValue(raw_data.Quantity),
    location: clean(raw_data.Location),
    remarks: clean(raw_data.Remarks),
    reorder_level: clean(raw_data['Reorder Level']) ? integerValue(raw_data['Reorder Level']) : null,
    created_at: new Date(),
    updated_at: new Date(),
  })))

  const stockMovementRows = await canonicalRows(client, batchId, 'stock_movements')
  const stockMovementInserts: Array<InsertRow> = [...stockMovementInsertsFromLots]
  for (const { row_index, legacy_bubble_id, legacy_slug, raw_data } of stockMovementRows) {
    const productId = productBySku.get(normalizedKey(raw_data['Product Data']))
    if (!productId) {
      skipped.stockMovementsMissingProduct += 1
      continue
    }

    const quantity = signedMovementQuantity(raw_data)
    if (quantity === 0) {
      skipped.stockMovementsZeroQuantity += 1
      continue
    }

    stockMovementInserts.push({
      legacy_bubble_id: legacy_bubble_id ?? `stock-movement:${row_index}`,
      legacy_slug,
      movement_type: clean(raw_data['Movement Type']) ?? 'Unknown',
      product_id: productId,
      order_id: orderByNumber.get(normalizedKey(raw_data.Order)) ?? null,
      user_related_id: clean(raw_data['User Related']),
      warehouse_platform_id: warehouseByName.get(normalizedKey(raw_data.Warehouse)) ?? null,
      quantity,
      remark: clean(raw_data.Remarks ?? raw_data.Remark),
      created_by_user_id: clean(raw_data.Creator),
      created_at: dateValue(raw_data['Creation Date']) ?? new Date(),
      updated_at: new Date(),
    })
  }
  await insertRows(client, 'stock_movements', stockMovementInserts)

  await writeReconciliationReports(client, batchId, skipped)

  return skipped
}

try {
  const client = await pool.connect()
  try {
    const batchId = await latestBatchId(client)
    console.log(`Transforming Bubble import batch ${batchId}`)

    await client.query('begin')
    const skipped = await transform(client, batchId)
    await client.query('commit')

    const counts = await client.query<{ table_name: string; row_count: number }>(
      `select table_name, row_count::int
       from (
         select 'app_users' table_name, count(*) row_count from app_users
         union all select 'products', count(*) from products
         union all select 'shipping_countries', count(*) from shipping_countries
         union all select 'shipping_states', count(*) from shipping_states
         union all select 'shipping_couriers', count(*) from shipping_couriers
         union all select 'shipping_zones', count(*) from shipping_zones
         union all select 'shipping_rates', count(*) from shipping_rates
         union all select 'shipping_cod_rates', count(*) from shipping_cod_rates
         union all select 'shipping_accounts', count(*) from shipping_accounts
         union all select 'customers', count(*) from customers
         union all select 'orders', count(*) from orders
         union all select 'order_items', count(*) from order_items
         union all select 'stock_lots', count(*) from stock_lots
         union all select 'stock_balances', count(*) from stock_balances
         union all select 'stock_warehouses', count(*) from stock_warehouses
         union all select 'stock_movements', count(*) from stock_movements
       ) counts
       order by table_name`,
    )

    console.log('\nTransformed rows')
    console.table(counts.rows)
    console.log('\nSkipped rows')
    console.table([skipped])
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}
