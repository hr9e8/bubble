alter table woocommerce_stores
  add column if not exists webhook_secret_secret_ref text;
