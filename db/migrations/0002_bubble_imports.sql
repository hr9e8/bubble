create table if not exists bubble_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_dir text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists bubble_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references bubble_import_batches(id) on delete cascade,
  entity_name text not null,
  source_file text not null,
  source_variant text not null default 'canonical',
  row_index integer not null,
  legacy_bubble_id text,
  legacy_slug text,
  raw_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (batch_id, source_file, row_index)
);

create table if not exists bubble_import_relationships (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references bubble_import_batches(id) on delete cascade,
  entity_name text not null,
  source_file text not null,
  source_row_index integer not null,
  source_column text not null,
  target_token text not null,
  target_hint text,
  resolved_table text,
  resolved_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text unique,
  legacy_bubble_id text unique,
  name text not null,
  username text,
  email text,
  phone text,
  user_role text,
  platform_sales_team text,
  sales_team_location text,
  warehouse_relation_raw text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists sales_team_platforms (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  name text not null,
  order_prefix text,
  platform_category text,
  finance_approval_active boolean,
  order_min_limit_approval numeric(12,2),
  url text,
  stock_raw text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists warehouse_platforms (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  name text not null unique,
  order_prefix text,
  stock_raw text,
  stock_movement_raw text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists warehouse_user_relations (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  warehouse_name text not null,
  is_default boolean,
  legacy_slug text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists shipping_countries (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  name text not null,
  country_code text,
  currency text,
  lhdn_code text,
  phone_prefix text,
  shipping_states_raw text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists shipping_states (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  country_legacy_id text,
  name text not null,
  shortform text,
  lhdn_code text,
  legacy_slug text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists shipping_couriers (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  name text not null,
  tracking_url text,
  legacy_slug text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists shipping_zones (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  zone_name text not null,
  active boolean,
  apply_all_product boolean,
  country_legacy_id text,
  apply_products_raw text,
  states_raw text,
  shipping_rate_raw text,
  shipping_cod_rate_raw text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists shipping_rates (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  name text not null,
  active boolean,
  cod boolean,
  shipping_price numeric(12,2) not null default 0,
  shipping_type text,
  shipping_zone_legacy_id text,
  total_min numeric(12,2),
  total_max numeric(12,2),
  total_range text,
  weight_min_kg numeric(12,3),
  weight_max_kg numeric(12,3),
  weight_range_kg text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists shipping_cod_rates (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  name text not null,
  cod_price numeric(12,2) not null default 0,
  shipping_type text,
  shipping_zone_legacy_id text,
  total_min numeric(12,2),
  total_max numeric(12,2),
  total_range text,
  weight_min_kg numeric(12,3),
  weight_max_kg numeric(12,3),
  weight_range text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists shipping_accounts (
  id uuid primary key default gen_random_uuid(),
  sold_to_account_id text,
  pickup_account_id text,
  id_name text,
  courier_name text,
  courier_data_raw text,
  company text,
  name text,
  email text,
  phone_number text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  country text,
  zipcode text,
  user_name text,
  prefix text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  data_type text,
  name text not null,
  description text,
  legacy_slug text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists bundle_line_items (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  bundle_product_code text,
  product_code text,
  product_category text,
  quantity integer,
  price_retail numeric(12,2),
  price_distributor numeric(12,2),
  created_by text,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists product_credit_rates (
  id uuid primary key default gen_random_uuid(),
  active boolean,
  rate numeric(12,4),
  legacy_slug text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists product_credits (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  credit_required boolean,
  value numeric(12,4),
  legacy_slug text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  author_user_role text,
  note_type text,
  comment text,
  private boolean,
  related_invoice text,
  related_order_number text,
  related_customer_legacy_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_manifests (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  custom_courier text,
  manifest_datetime timestamptz,
  group_manifest_id text,
  handler_data text,
  shipping_awb_barcode text,
  shipping_awb_no text,
  shipping_courier_name text,
  weight numeric(12,3),
  legacy_slug text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_website_owners (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  website text not null,
  legacy_slug text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists stock_warehouses (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  warehouse_platform_name text not null,
  warehouse_stock_type text,
  quantity integer not null default 0,
  location text,
  remarks text,
  reorder_level integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bubble_import_rows_batch_entity_idx on bubble_import_rows (batch_id, entity_name);
create index if not exists bubble_import_rows_legacy_idx on bubble_import_rows (legacy_bubble_id);
create index if not exists bubble_import_relationships_token_idx on bubble_import_relationships (target_token);
create index if not exists app_users_legacy_idx on app_users (legacy_bubble_id);
create index if not exists app_users_name_idx on app_users (name);
create index if not exists shipping_rates_zone_idx on shipping_rates (shipping_zone_legacy_id);
create index if not exists shipping_cod_rates_zone_idx on shipping_cod_rates (shipping_zone_legacy_id);
create index if not exists notes_order_idx on notes (related_order_number);
create index if not exists order_manifests_order_idx on order_manifests (order_number);
create index if not exists stock_warehouses_product_idx on stock_warehouses (product_code);
