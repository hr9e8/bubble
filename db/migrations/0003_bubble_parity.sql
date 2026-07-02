create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists user_permissions (
  user_id text not null,
  permission_id uuid not null references permissions(id) on delete cascade,
  granted boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  legacy_bubble_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table app_users
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists zip_code text,
  add column if not exists profile_image_file_id uuid references files(id),
  add column if not exists slug text,
  add column if not exists social_networks jsonb not null default '{}'::jsonb,
  add column if not exists distributor_code text,
  add column if not exists distributor_level text,
  add column if not exists platform_id uuid references sales_team_platforms(id),
  add column if not exists team_leader_user_id text;

alter table sales_leader_members
  add column if not exists leader_app_user_id uuid references app_users(id),
  add column if not exists member_app_user_id uuid references app_users(id),
  add column if not exists active_from timestamptz,
  add column if not exists active_until timestamptz,
  add column if not exists active boolean not null default true;

create table if not exists woocommerce_stores (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid references sales_team_platforms(id),
  name text not null,
  store_url text not null,
  consumer_key_secret_ref text not null,
  consumer_secret_secret_ref text not null,
  webhook_secret_secret_ref text,
  platform text,
  order_prefix text,
  sync_status text not null default 'disconnected',
  last_synced_at timestamptz,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table woocommerce_stores
  add column if not exists webhook_secret_secret_ref text;

create table if not exists woocommerce_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references woocommerce_stores(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  cursor_data jsonb not null default '{}'::jsonb,
  imported_orders integer not null default 0,
  error_message text,
  created_by_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists woocommerce_webhook_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references woocommerce_stores(id) on delete cascade,
  event_topic text not null,
  delivery_id text,
  woo_order_id text,
  payload jsonb not null,
  signature text,
  status text not null default 'received',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (store_id, delivery_id)
);

alter table products
  add column if not exists gallery_file_ids uuid[] not null default '{}',
  add column if not exists length_cm numeric(12,3),
  add column if not exists width_cm numeric(12,3),
  add column if not exists height_cm numeric(12,3),
  add column if not exists supplier_name text,
  add column if not exists product_type text,
  add column if not exists shortform text,
  add column if not exists price_list jsonb not null default '{}'::jsonb,
  add column if not exists custom_bundle_price numeric(12,2),
  add column if not exists hide_retail boolean not null default false,
  add column if not exists hide_distributor boolean not null default false,
  add column if not exists credit_required boolean not null default false,
  add column if not exists credit_value numeric(12,4);

alter table bundle_line_items
  add column if not exists bundle_product_id uuid references products(id),
  add column if not exists child_product_id uuid references products(id);

create table if not exists shipping_zone_states (
  shipping_zone_id uuid not null references shipping_zones(id) on delete cascade,
  shipping_state_id uuid not null references shipping_states(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shipping_zone_id, shipping_state_id)
);

create table if not exists shipping_zone_products (
  shipping_zone_id uuid not null references shipping_zones(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shipping_zone_id, product_id)
);

create table if not exists shipping_zone_rates (
  shipping_zone_id uuid not null references shipping_zones(id) on delete cascade,
  shipping_rate_id uuid not null references shipping_rates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shipping_zone_id, shipping_rate_id)
);

create table if not exists shipping_zone_cod_rates (
  shipping_zone_id uuid not null references shipping_zones(id) on delete cascade,
  shipping_cod_rate_id uuid not null references shipping_cod_rates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shipping_zone_id, shipping_cod_rate_id)
);

alter table orders
  add column if not exists customer_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists order_website text,
  add column if not exists platform_category text,
  add column if not exists platform_option text,
  add column if not exists cod_amount numeric(12,2) not null default 0,
  add column if not exists cod_fee numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists item_quantity_total integer not null default 0,
  add column if not exists item_quantity_distinct integer not null default 0,
  add column if not exists finance_hold boolean not null default false,
  add column if not exists finance_hold_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id text,
  add column if not exists cancellation_reason text,
  add column if not exists note_summary text,
  add column if not exists tracking_ids jsonb not null default '[]'::jsonb,
  add column if not exists packed_by_user_id text,
  add column if not exists packed_at timestamptz,
  add column if not exists woo_store_id uuid references woocommerce_stores(id),
  add column if not exists woo_order_id text,
  add column if not exists woo_transaction_id text,
  add column if not exists woo_metadata jsonb not null default '{}'::jsonb,
  add column if not exists manually_processed_at timestamptz;

create unique index if not exists orders_woo_store_order_unique
  on orders (woo_store_id, woo_order_id)
  where woo_store_id is not null and woo_order_id is not null;

create table if not exists order_tags (
  order_id uuid not null references orders(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (order_id, tag_id)
);

create table if not exists order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  note_id uuid references notes(id) on delete set null,
  body text not null,
  private boolean not null default false,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_proof_id uuid references payment_proofs(id) on delete set null,
  file_id uuid references files(id),
  proof_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id text,
  created_at timestamptz not null default now()
);

alter table stock_movements
  add constraint stock_movements_quantity_nonzero check (quantity <> 0) not valid;

create or replace function prevent_stock_movement_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_movements are append-only; create a correcting movement instead';
end;
$$;

drop trigger if exists stock_movements_no_delete on stock_movements;
create trigger stock_movements_no_delete
before delete on stock_movements
for each row execute function prevent_stock_movement_delete();

create or replace view stock_balance_ledger as
select
  product_id,
  user_related_id as owner_user_id,
  warehouse_platform_id,
  sum(quantity) as available_quantity
from stock_movements
group by product_id, user_related_id, warehouse_platform_id;

alter table payment_verifications
  add column if not exists queue_owner_user_id text,
  add column if not exists decision text,
  add column if not exists rejected_reason text,
  add column if not exists finance_hold_reason text,
  add column if not exists decided_at timestamptz;

create table if not exists warehouse_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  event_type text not null,
  courier_id uuid references shipping_couriers(id),
  tracking_number text,
  tracking_url text,
  shipment_id text,
  awb_label_file_id uuid references files(id),
  packed_by_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists migration_reconciliation_reports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references bubble_import_batches(id) on delete cascade,
  report_type text not null,
  status text not null default 'open',
  summary jsonb not null default '{}'::jsonb,
  detail jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on audit_logs (entity_table, entity_id, created_at desc);
create index if not exists woocommerce_sync_jobs_store_status_idx on woocommerce_sync_jobs (store_id, status, created_at desc);
create index if not exists woocommerce_webhook_events_store_order_idx on woocommerce_webhook_events (store_id, woo_order_id, created_at desc);
create unique index if not exists woocommerce_webhook_events_delivery_unique
  on woocommerce_webhook_events (store_id, delivery_id)
  where delivery_id is not null;
create index if not exists order_notes_order_created_idx on order_notes (order_id, created_at desc);
create index if not exists warehouse_events_order_created_idx on warehouse_events (order_id, created_at desc);
create index if not exists migration_reconciliation_batch_idx on migration_reconciliation_reports (batch_id, report_type);
create unique index if not exists payment_verifications_order_unique on payment_verifications (order_id);

insert into permissions (key, description)
values
  ('admin:manage', 'Manage users, roles, products, shipping, platforms, WooCommerce, and migration'),
  ('orders:own', 'Create and view own sales orders and customers'),
  ('orders:team', 'View assigned team orders and summaries'),
  ('orders:all', 'View and manage all orders'),
  ('stock:own', 'View own stock balances'),
  ('stock:team_transfer', 'Transfer stock between assigned team members'),
  ('stock:warehouse', 'Receive and adjust warehouse stock'),
  ('finance:verify', 'Assign, verify, reject, and hold manual payments'),
  ('warehouse:fulfill', 'Pick, pack, track, and ship verified orders'),
  ('migration:run', 'Run Bubble import, transform, reconciliation, and cutover'),
  ('woocommerce:manage', 'Connect stores, sync orders, and inspect webhooks')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
cross join permissions
where roles.name = 'admin'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.key in ('orders:own', 'stock:own')
where roles.name = 'sales_team'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.key in ('orders:own', 'orders:team', 'stock:own', 'stock:team_transfer')
where roles.name = 'sales_leader'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.key = 'finance:verify'
where roles.name = 'finance'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.key in ('stock:warehouse', 'warehouse:fulfill')
where roles.name = 'warehouse_manager'
on conflict do nothing;
