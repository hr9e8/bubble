# Bubble Data Profile

Generated from `data-example` on 2026-06-30.

## Canonical Export Choices

Use these files first for raw staging because they contain the richest columns or the needed Bubble IDs:

- `All Users-modified 2.csv`
- `Bundle-Line-Items.csv`
- `Customers.csv`
- `Notes.csv`
- `Order-Cart-Line-Items.csv`
- `Order-Line-Items.csv`
- `Order-Manifests.csv`
- `Order-Website-Owners.csv`
- `data-example-2/Orders-Column.csv`
- `Product-Credit-Rates.csv`
- `Product-Credits.csv`
- `data-example-2/Products-modified-copied.csv`
- `Sales-Team-Platforms.csv`
- `Shipping-Account-IDS.csv`
- `Shipping-Countries.csv`
- `Shipping-Couriers.csv`
- `Shipping-Methods-modified-copied.csv`
- `Shipping-Rate-CODS-modified-copied.csv`
- `Shipping-States-copied.csv`
- `Shipping-Zones-modified.csv`
- `Stock-Movements-modified.csv`
- `Stock-Warehouses.csv`
- `Stocks-modified-copied.csv`
- `Tags.csv`
- `Warehouse-Platforms.csv`
- `Warehouse-User-Relations.csv`

Variant files are still imported into raw staging for comparison where they contain complementary columns.

## Parsed Counts

- Users: 51
- Customers: 18,213
- Orders first export: 24,802
- Orders fuller replacement export: 14,944
- Order line items: 54,068
- Order manifests: 2,532
- Products first export: 329
- Products fuller replacement export: 271
- Bundle line items: 1,793
- Stock rows: 1,356
- Stock movements: 30,495
- Stock warehouses: 84
- Shipping methods/rates: 39
- Shipping COD rates: 11
- Shipping states: 16
- Shipping zones: 5
- Warehouse platforms: 3
- Warehouse-user relations: 59

## Important Gaps

Several CSVs are partial Bubble exports, so normalized transforms must not assume every historical row has the full field list.

- `data-example-2/Orders-Column.csv` fixes the missing order fields, but contains 14,944 rows vs the first `Orders.csv` count of 24,802. Treat it as the canonical rich order export and keep the first `Orders.csv` as a coverage variant until a full rich export is available.
- `data-example-2/Products-modified-copied.csv` fixes the missing product fields, but contains 271 rows vs the first `Products.csv` count of 329. Treat it as canonical for active/catalog products and keep the first `Products.csv` as a coverage variant.
- `Customers.csv` lacks `unique id`, created/modified timestamps, seller, state, phone, zip code, and slug.
- Some lookup files have complementary variants. For example `Shipping-States-copied.csv` has `unique id`, while `Shipping-States.csv` has `LHDN Code`.

The importer therefore stages raw rows first and extracts relationship tokens separately. The next transform step should either merge variant files or request fuller exports for the critical tables before production migration.

## Commands

Profile all uploaded CSVs:

```bash
pnpm data:profile
```

Dry-run the configured canonical and variant import:

```bash
pnpm data:import:dry
```

Import into Postgres after setting `DATABASE_URL` and running migrations:

```bash
pnpm db:migrate
pnpm data:import
```
