import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
export type Numeric = ColumnType<string, string | number, string | number>
export type JsonValue = string | number | boolean | null | Array<JsonValue> | { [key: string]: JsonValue }
export type JsonColumn = ColumnType<JsonValue, JsonValue | string | undefined, JsonValue | string>
export type Defaulted<T> = ColumnType<T, T | undefined, T>

export type AppRoleName =
  | 'admin'
  | 'sales_team'
  | 'sales_leader'
  | 'finance'
  | 'warehouse_manager'

export type AuthUserTable = {
  id: string
  name: string
  email: string
  email_verified: boolean
  image: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type AuthSessionTable = {
  id: string
  user_id: string
  token: string
  expires_at: Timestamp
  ip_address: string | null
  user_agent: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type AuthAccountTable = {
  id: string
  account_id: string
  provider_id: string
  user_id: string
  access_token: string | null
  refresh_token: string | null
  id_token: string | null
  access_token_expires_at: Timestamp | null
  refresh_token_expires_at: Timestamp | null
  scope: string | null
  password: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type AuthVerificationTable = {
  id: string
  identifier: string
  value: string
  expires_at: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export type RoleTable = {
  id: Generated<string>
  name: AppRoleName
  description: string | null
  created_at: Timestamp
}

export type UserRoleTable = {
  user_id: string
  role_id: string
  created_at: Timestamp
}

export type PermissionTable = {
  id: Generated<string>
  key: string
  description: string | null
  created_at: Timestamp
}

export type RolePermissionTable = {
  role_id: string
  permission_id: string
  created_at: Timestamp
}

export type UserPermissionTable = {
  user_id: string
  permission_id: string
  granted: boolean
  created_at: Timestamp
}

export type AuditLogTable = {
  id: Generated<string>
  actor_user_id: string | null
  action: string
  entity_table: string
  entity_id: string | null
  legacy_bubble_id: string | null
  before_data: JsonColumn | null
  after_data: JsonColumn | null
  metadata: JsonColumn
  created_at: Timestamp
}

export type SalesLeaderMemberTable = {
  leader_user_id: string
  member_user_id: string
  leader_app_user_id: string | null
  member_app_user_id: string | null
  active_from: Timestamp | null
  active_until: Timestamp | null
  active: boolean
  created_at: Timestamp
}

export type LegacyColumns = {
  legacy_bubble_id: string | null
  legacy_slug: string | null
  created_by_user_id: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type ProductTable = LegacyColumns & {
  id: Generated<string>
  category_id: string | null
  name: string
  description: string | null
  sku_code: string | null
  manufacturer_barcode: string | null
  price_retail: Numeric
  price_distributor: Numeric
  weight_g: number | null
  reorder_level: number | null
  status_ready: boolean
  image_file_id: string | null
  gallery_file_ids: Defaulted<Array<string>>
  length_cm: Numeric | null
  width_cm: Numeric | null
  height_cm: Numeric | null
  supplier_name: string | null
  product_type: string | null
  shortform: string | null
  price_list: JsonColumn
  custom_bundle_price: Numeric | null
  hide_retail: Defaulted<boolean>
  hide_distributor: Defaulted<boolean>
  credit_required: Defaulted<boolean>
  credit_value: Numeric | null
}

export type ProductCategoryTable = LegacyColumns & {
  id: Generated<string>
  name: string
  description: string | null
}

export type CustomerTable = LegacyColumns & {
  id: Generated<string>
  seller_user_id: string | null
  name: string
  email: string | null
  phone: string | null
  address_line: string | null
  city: string | null
  state: string | null
  country: string | null
  zip_code: string | null
  note: string | null
}

export type OrderTable = LegacyColumns & {
  id: Generated<string>
  order_number: string
  seller_user_id: string | null
  customer_id: string | null
  platform_id: string | null
  warehouse_platform_id: string | null
  order_status: string
  fulfillment_status: string | null
  payment_status: string | null
  payment_method: string | null
  currency: Defaulted<string>
  subtotal_amount: Numeric
  shipping_total: Numeric
  transaction_fee: Numeric
  total_amount: Numeric
  tracking_courier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipped_at: Timestamp | null
  customer_snapshot: JsonColumn
  order_website: string | null
  platform_category: string | null
  platform_option: string | null
  cod_amount: ColumnType<string, string | number | undefined, string | number>
  cod_fee: ColumnType<string, string | number | undefined, string | number>
  discount_amount: ColumnType<string, string | number | undefined, string | number>
  item_quantity_total: Defaulted<number>
  item_quantity_distinct: Defaulted<number>
  finance_hold: Defaulted<boolean>
  finance_hold_reason: string | null
  cancelled_at: Timestamp | null
  cancelled_by_user_id: string | null
  cancellation_reason: string | null
  note_summary: string | null
  tracking_ids: JsonColumn
  packed_by_user_id: string | null
  packed_at: Timestamp | null
  woo_store_id: string | null
  woo_order_id: string | null
  woo_transaction_id: string | null
  woo_metadata: JsonColumn
  manually_processed_at: Timestamp | null
}

export type OrderItemTable = LegacyColumns & {
  id: Generated<string>
  order_id: string
  product_id: string | null
  bundle_parent_id: string | null
  quantity: number
  order_price: Numeric
  order_line_total: Numeric
  fulfillment_status: string | null
}

export type StockLotTable = LegacyColumns & {
  id: Generated<string>
  product_id: string
  owner_user_id: string | null
  warehouse_platform_id: string | null
  location: string | null
  quantity_initial: number
  sellable_status: string | null
  date_received: Timestamp | null
  do_number: string | null
  inbound_number: string | null
}

export type StockMovementTable = LegacyColumns & {
  id: Generated<string>
  movement_type: string
  product_id: string
  order_id: string | null
  user_related_id: string | null
  warehouse_platform_id: string | null
  quantity: number
  remark: string | null
}

export type StockBalanceTable = {
  id: Generated<string>
  product_id: string
  owner_user_id: string | null
  warehouse_platform_id: string | null
  available_quantity: number
  committed_quantity: number
  reorder_level: number | null
  updated_at: Timestamp
}

export type StockBalanceLedgerTable = {
  product_id: string
  owner_user_id: string | null
  warehouse_platform_id: string | null
  available_quantity: Numeric
}

export type FileTable = {
  id: Generated<string>
  storage_provider: 'bunny'
  storage_zone: string
  path: string
  public_url: string
  mime_type: string | null
  size_bytes: number | null
  original_filename: string | null
  uploaded_by_user_id: string | null
  created_at: Timestamp
}

export type PaymentProofTable = LegacyColumns & {
  id: Generated<string>
  order_id: string
  file_id: string
  proof_type: string | null
}

export type PaymentVerificationTable = {
  id: Generated<string>
  order_id: string
  assigned_to_user_id: string | null
  queue_owner_user_id: string | null
  status: string
  decision: string | null
  rejected_reason: string | null
  finance_hold_reason: string | null
  remarks: string | null
  verified_by_user_id: string | null
  verified_at: Timestamp | null
  decided_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type ExportJobTable = {
  id: Generated<string>
  requested_by_user_id: string
  export_type: string
  filters_json: unknown
  status: string
  file_id: string | null
  row_count: number | null
  error_message: string | null
  created_at: Timestamp
  completed_at: Timestamp | null
}

export type BubbleImportBatchTable = {
  id: Generated<string>
  source_dir: string
  profile: JsonColumn
  created_at: Timestamp
}

export type BubbleImportRowTable = {
  id: Generated<string>
  batch_id: string
  entity_name: string
  source_file: string
  source_variant: string
  row_index: number
  legacy_bubble_id: string | null
  legacy_slug: string | null
  raw_data: JsonColumn
  created_at: Timestamp
}

export type BubbleImportRelationshipTable = {
  id: Generated<string>
  batch_id: string
  entity_name: string
  source_file: string
  source_row_index: number
  source_column: string
  target_token: string
  target_hint: string | null
  resolved_table: string | null
  resolved_id: string | null
  created_at: Timestamp
}

export type AppUserTable = {
  id: Generated<string>
  auth_user_id: string | null
  legacy_bubble_id: string | null
  name: string
  username: string | null
  email: string | null
  phone: string | null
  user_role: string | null
  platform_sales_team: string | null
  sales_team_location: string | null
  warehouse_relation_raw: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  country: string | null
  zip_code: string | null
  profile_image_file_id: string | null
  slug: string | null
  social_networks: JsonColumn
  distributor_code: string | null
  distributor_level: string | null
  platform_id: string | null
  team_leader_user_id: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type WooCommerceStoreTable = {
  id: Generated<string>
  platform_id: string | null
  name: string
  store_url: string
  consumer_key_secret_ref: string
  consumer_secret_secret_ref: string
  webhook_secret_secret_ref: string | null
  platform: string | null
  order_prefix: string | null
  sync_status: Defaulted<string>
  last_synced_at: Timestamp | null
  created_by_user_id: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type WooCommerceSyncJobTable = {
  id: Generated<string>
  store_id: string
  job_type: string
  status: Defaulted<string>
  started_at: Timestamp | null
  completed_at: Timestamp | null
  cursor_data: JsonColumn
  imported_orders: Defaulted<number>
  error_message: string | null
  created_by_user_id: string | null
  created_at: Timestamp
}

export type WooCommerceWebhookEventTable = {
  id: Generated<string>
  store_id: string
  event_topic: string
  delivery_id: string | null
  woo_order_id: string | null
  payload: JsonColumn
  signature: string | null
  status: Defaulted<string>
  processed_at: Timestamp | null
  error_message: string | null
  created_at: Timestamp
}

export type SalesTeamPlatformTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  name: string
  order_prefix: string | null
  platform_category: string | null
  finance_approval_active: boolean | null
  order_min_limit_approval: Numeric | null
  url: string | null
  stock_raw: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type WarehousePlatformTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  name: string
  order_prefix: string | null
  stock_raw: string | null
  stock_movement_raw: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type WarehouseUserRelationTable = {
  id: Generated<string>
  user_name: string | null
  warehouse_name: string
  is_default: boolean | null
  legacy_slug: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export type ShippingCountryTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  name: string
  country_code: string | null
  currency: string | null
  lhdn_code: string | null
  phone_prefix: string | null
  shipping_states_raw: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type ShippingStateTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  country_legacy_id: string | null
  name: string
  shortform: string | null
  lhdn_code: string | null
  legacy_slug: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export type ShippingCourierTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  name: string
  tracking_url: string | null
  legacy_slug: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export type ShippingZoneTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  zone_name: string
  active: boolean | null
  apply_all_product: boolean | null
  country_legacy_id: string | null
  apply_products_raw: string | null
  states_raw: string | null
  shipping_rate_raw: string | null
  shipping_cod_rate_raw: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type ShippingRateTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  name: string
  active: boolean | null
  cod: boolean | null
  shipping_price: Numeric
  shipping_type: string | null
  shipping_zone_legacy_id: string | null
  total_min: Numeric | null
  total_max: Numeric | null
  total_range: string | null
  weight_min_kg: Numeric | null
  weight_max_kg: Numeric | null
  weight_range_kg: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type ShippingCodRateTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  name: string
  cod_price: Numeric
  shipping_type: string | null
  shipping_zone_legacy_id: string | null
  total_min: Numeric | null
  total_max: Numeric | null
  total_range: string | null
  weight_min_kg: Numeric | null
  weight_max_kg: Numeric | null
  weight_range: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type ShippingAccountTable = {
  id: Generated<string>
  sold_to_account_id: string | null
  pickup_account_id: string | null
  id_name: string | null
  courier_name: string | null
  courier_data_raw: string | null
  company: string | null
  name: string | null
  email: string | null
  phone_number: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  country: string | null
  zipcode: string | null
  user_name: string | null
  prefix: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type TagTable = {
  id: Generated<string>
  data_type: string | null
  name: string
  description: string | null
  legacy_slug: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export type BundleLineItemTable = {
  id: Generated<string>
  legacy_bubble_id: string | null
  bundle_product_code: string | null
  product_code: string | null
  bundle_product_id: string | null
  child_product_id: string | null
  product_category: string | null
  quantity: number | null
  price_retail: Numeric | null
  price_distributor: Numeric | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp
}

export type ShippingZoneStateTable = {
  shipping_zone_id: string
  shipping_state_id: string
  created_at: Timestamp
}

export type ShippingZoneProductTable = {
  shipping_zone_id: string
  product_id: string
  created_at: Timestamp
}

export type ShippingZoneRateTable = {
  shipping_zone_id: string
  shipping_rate_id: string
  created_at: Timestamp
}

export type ShippingZoneCodRateTable = {
  shipping_zone_id: string
  shipping_cod_rate_id: string
  created_at: Timestamp
}

export type ProductCreditRateTable = {
  id: Generated<string>
  active: boolean | null
  rate: Numeric | null
  legacy_slug: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export type ProductCreditTable = {
  id: Generated<string>
  product_code: string
  credit_required: boolean | null
  value: Numeric | null
  legacy_slug: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export type NoteTable = {
  id: Generated<string>
  author_user_role: string | null
  note_type: string | null
  comment: string | null
  private: boolean | null
  related_invoice: string | null
  related_order_number: string | null
  related_customer_legacy_id: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type OrderManifestTable = {
  id: Generated<string>
  order_number: string
  custom_courier: string | null
  manifest_datetime: Timestamp | null
  group_manifest_id: string | null
  handler_data: string | null
  shipping_awb_barcode: string | null
  shipping_awb_no: string | null
  shipping_courier_name: string | null
  weight: Numeric | null
  legacy_slug: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type OrderWebsiteOwnerTable = {
  id: Generated<string>
  user_name: string | null
  website: string
  legacy_slug: string | null
  created_by: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export type StockWarehouseTable = {
  id: Generated<string>
  product_code: string
  warehouse_platform_name: string
  warehouse_stock_type: string | null
  quantity: number
  location: string | null
  remarks: string | null
  reorder_level: number | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type OrderTagTable = {
  order_id: string
  tag_id: string
  created_at: Timestamp
}

export type OrderNoteTable = {
  id: Generated<string>
  order_id: string
  note_id: string | null
  body: string
  private: boolean
  created_by_user_id: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type OrderPaymentProofTable = {
  id: Generated<string>
  order_id: string
  payment_proof_id: string | null
  file_id: string | null
  proof_type: string | null
  metadata: JsonColumn
  created_by_user_id: string | null
  created_at: Timestamp
}

export type WarehouseEventTable = {
  id: Generated<string>
  order_id: string
  event_type: string
  courier_id: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipment_id: string | null
  awb_label_file_id: string | null
  packed_by_user_id: string | null
  metadata: JsonColumn
  created_by_user_id: string | null
  created_at: Timestamp
}

export type MigrationReconciliationReportTable = {
  id: Generated<string>
  batch_id: string
  report_type: string
  status: Defaulted<string>
  summary: JsonColumn
  detail: JsonColumn
  created_at: Timestamp
}

export type Database = {
  auth_accounts: AuthAccountTable
  auth_sessions: AuthSessionTable
  auth_users: AuthUserTable
  auth_verifications: AuthVerificationTable
  roles: RoleTable
  user_roles: UserRoleTable
  permissions: PermissionTable
  role_permissions: RolePermissionTable
  user_permissions: UserPermissionTable
  audit_logs: AuditLogTable
  sales_leader_members: SalesLeaderMemberTable
  bubble_import_batches: BubbleImportBatchTable
  bubble_import_rows: BubbleImportRowTable
  bubble_import_relationships: BubbleImportRelationshipTable
  app_users: AppUserTable
  woocommerce_stores: WooCommerceStoreTable
  woocommerce_sync_jobs: WooCommerceSyncJobTable
  woocommerce_webhook_events: WooCommerceWebhookEventTable
  sales_team_platforms: SalesTeamPlatformTable
  warehouse_platforms: WarehousePlatformTable
  warehouse_user_relations: WarehouseUserRelationTable
  shipping_countries: ShippingCountryTable
  shipping_states: ShippingStateTable
  shipping_couriers: ShippingCourierTable
  shipping_zones: ShippingZoneTable
  shipping_rates: ShippingRateTable
  shipping_cod_rates: ShippingCodRateTable
  shipping_zone_states: ShippingZoneStateTable
  shipping_zone_products: ShippingZoneProductTable
  shipping_zone_rates: ShippingZoneRateTable
  shipping_zone_cod_rates: ShippingZoneCodRateTable
  shipping_accounts: ShippingAccountTable
  tags: TagTable
  bundle_line_items: BundleLineItemTable
  product_credit_rates: ProductCreditRateTable
  product_credits: ProductCreditTable
  notes: NoteTable
  order_manifests: OrderManifestTable
  order_website_owners: OrderWebsiteOwnerTable
  order_tags: OrderTagTable
  order_notes: OrderNoteTable
  order_payment_proofs: OrderPaymentProofTable
  warehouse_events: WarehouseEventTable
  migration_reconciliation_reports: MigrationReconciliationReportTable
  stock_warehouses: StockWarehouseTable
  product_categories: ProductCategoryTable
  products: ProductTable
  customers: CustomerTable
  orders: OrderTable
  order_items: OrderItemTable
  stock_lots: StockLotTable
  stock_movements: StockMovementTable
  stock_balances: StockBalanceTable
  stock_balance_ledger: StockBalanceLedgerTable
  files: FileTable
  payment_proofs: PaymentProofTable
  payment_verifications: PaymentVerificationTable
  export_jobs: ExportJobTable
}

export type Product = Selectable<ProductTable>
export type NewProduct = Insertable<ProductTable>
export type ProductUpdate = Updateable<ProductTable>
export type Order = Selectable<OrderTable>
export type NewOrder = Insertable<OrderTable>
export type Customer = Selectable<CustomerTable>
export type NewCustomer = Insertable<CustomerTable>
