create extension if not exists pgcrypto;

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id text not null,
  role_id uuid not null references roles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists sales_leader_members (
  leader_user_id text not null,
  member_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (leader_user_id, member_user_id)
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  storage_provider text not null default 'bunny',
  storage_zone text not null,
  path text not null,
  public_url text not null,
  mime_type text,
  size_bytes integer,
  original_filename text,
  uploaded_by_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  name text not null,
  description text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  category_id uuid references product_categories(id),
  name text not null,
  description text,
  sku_code text,
  manufacturer_barcode text,
  price_retail numeric(12,2) not null default 0,
  price_distributor numeric(12,2) not null default 0,
  weight_g integer,
  reorder_level integer,
  status_ready boolean not null default true,
  image_file_id uuid references files(id),
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  seller_user_id text,
  name text not null,
  email text,
  phone text,
  address_line text,
  city text,
  state text,
  country text,
  zip_code text,
  note text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  order_number text not null unique,
  seller_user_id text,
  customer_id uuid references customers(id),
  platform_id uuid,
  warehouse_platform_id uuid,
  order_status text not null,
  fulfillment_status text,
  payment_status text,
  payment_method text,
  currency text not null default 'MYR',
  subtotal_amount numeric(12,2) not null default 0,
  shipping_total numeric(12,2) not null default 0,
  transaction_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  tracking_courier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  bundle_parent_id uuid,
  quantity integer not null,
  order_price numeric(12,2) not null default 0,
  order_line_total numeric(12,2) not null default 0,
  fulfillment_status text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stock_lots (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  product_id uuid not null references products(id),
  owner_user_id text,
  warehouse_platform_id uuid,
  location text,
  quantity_initial integer not null default 0,
  sellable_status text,
  date_received timestamptz,
  do_number text,
  inbound_number text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  movement_type text not null,
  product_id uuid not null references products(id),
  order_id uuid references orders(id),
  user_related_id text,
  warehouse_platform_id uuid,
  quantity integer not null,
  remark text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stock_balances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  owner_user_id text,
  warehouse_platform_id uuid,
  available_quantity integer not null default 0,
  committed_quantity integer not null default 0,
  reorder_level integer,
  updated_at timestamptz not null default now()
);

create table if not exists payment_proofs (
  id uuid primary key default gen_random_uuid(),
  legacy_bubble_id text unique,
  legacy_slug text,
  order_id uuid not null references orders(id) on delete cascade,
  file_id uuid not null references files(id),
  proof_type text,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_verifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  assigned_to_user_id text,
  status text not null,
  remarks text,
  verified_by_user_id text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists export_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id text not null,
  export_type text not null,
  filters_json jsonb not null default '{}'::jsonb,
  status text not null,
  file_id uuid references files(id),
  row_count integer,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists orders_seller_created_idx on orders (seller_user_id, created_at desc);
create index if not exists orders_status_created_idx on orders (order_status, created_at desc);
create index if not exists orders_payment_status_created_idx on orders (payment_status, created_at desc);
create index if not exists orders_fulfillment_status_created_idx on orders (fulfillment_status, created_at desc);
create index if not exists customers_seller_name_idx on customers (seller_user_id, name);
create index if not exists customers_phone_idx on customers (phone);
create index if not exists products_sku_idx on products (sku_code);
create index if not exists stock_balances_owner_product_idx on stock_balances (owner_user_id, product_id);
create index if not exists stock_movements_product_created_idx on stock_movements (product_id, created_at desc);
create index if not exists payment_verifications_status_created_idx on payment_verifications (status, created_at desc);

insert into roles (name, description)
values
  ('admin', 'Full system access'),
  ('sales_team', 'Own customers, orders, and assigned stock'),
  ('sales_leader', 'Own records plus assigned sales team stock visibility'),
  ('finance', 'Payment verification and finance hold workflow'),
  ('warehouse_manager', 'Fulfillment, manifests, tracking, and warehouse stock')
on conflict (name) do nothing;
