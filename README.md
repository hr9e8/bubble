# Bubble

Bubble is the TanStack Start rebuild of the OCOC operations back office. It replaces the current Bubble-based workflow with a Postgres-backed app for admin setup, orders, customers, stock, finance verification, warehouse fulfillment, WooCommerce imports, and scripted Bubble CSV migration.

## Project Summary

The app is built around role-scoped operational work:

- Admins configure users, roles, products, pricing, shipping, couriers, platforms, warehouses, stock setup, WooCommerce stores, and migration runs.
- Sales users manage customers and orders within their permitted sales scope.
- Finance users verify manual COD and bank-transfer payments.
- Warehouse users pick, pack, ship, add tracking details, and review manifests.
- Migration scripts preserve raw Bubble exports, transform them into normalized tables, and write reconciliation reports.

## Feature Status

### Completed

- Authenticated app shell with Better Auth email/password login, initial admin setup, logout, current-user context, and role-scoped navigation.
- Dashboard showing scoped order, customer, finance, warehouse, monthly sales, and pipeline metrics.
- Admin foundation screens for users, roles and permissions, products, pricing, shipping, couriers, platforms, stock setup, warehouses, WooCommerce, and migration.
- RBAC helpers and tests for direct permissions, database-backed role grants, and sales-scope enforcement.
- Order listing with filters, search, detail view, status changes, and new-order creation.
- Customer listing and customer detail pages.
- Stock overview, movement ledger, stock receive, stock transfer, and stock adjustment workflows.
- Finance verification queue with assignment, verify, hold, and reject decisions.
- Warehouse queue with pick, pack, ship actions, tracking detail capture, and manifest listing.
- Bubble CSV tooling for profiling, raw import staging, normalized transforms, import status, and reconciliation outputs.
- Postgres migrations for core operational tables, Bubble import tables, parity fields, and Better Auth tables.
- Unit coverage for business rules, stock correctness, exports, migration CSV parsing, RBAC, and utility helpers.
- Netlify deployment configuration for TanStack Start server functions and API routes.

### In Progress

- WooCommerce production rollout: store connection, reachability tests, queued syncs, webhook intake, credential references, and encrypted pasted secrets are implemented, but require real store credentials and webhook configuration per environment.
- Bubble migration cutover: scripts and reconciliation checks are implemented, but final migration depends on the latest export set, reviewed mismatch reports, and an approved lock/cutover process.
- Data completeness and parity review for imported Bubble fields, especially any edge cases that only appear in production exports.
- Operational hardening around production environment variables, secrets, storage, and deployment smoke tests.

### Planned / Next

- Broader end-to-end tests for the primary order, finance, warehouse, and WooCommerce flows.
- More reporting/export views for day-to-day operations.
- Production observability and runbooks for imports, sync jobs, webhooks, and reconciliation failures.
- Final UX polish after real user acceptance testing.

## Tech Stack

- TanStack Start, TanStack Router, React 19, and Vite
- TypeScript
- PostgreSQL with Kysely
- Better Auth
- Tailwind CSS
- Vitest
- Netlify TanStack Start adapter

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a local environment file from `.env.example` and set at least:

```bash
DATABASE_URL="postgres://user:password@localhost:5432/bubble_rebuild"
BETTER_AUTH_SECRET="replace-with-at-least-32-random-characters"
BETTER_AUTH_URL="http://localhost:3000"
```

Run database migrations:

```bash
pnpm db:migrate
```

Start the dev server:

```bash
pnpm dev
```

The app runs on `http://localhost:3000`.

## Scripts

```bash
pnpm dev                 # Start Vite dev server on port 3000
pnpm build               # Build for production
pnpm preview             # Preview production build
pnpm test                # Run Vitest tests
pnpm generate-routes     # Regenerate TanStack Router route tree
pnpm db:migrate          # Apply database migrations
pnpm data:profile        # Profile Bubble CSV exports
pnpm data:import         # Import Bubble CSV rows into raw staging tables
pnpm data:import:dry     # Dry-run Bubble CSV import
pnpm data:transform      # Transform staged Bubble rows into managed tables
pnpm data:status         # Show latest Bubble import status
pnpm woocommerce:sync    # Run WooCommerce sync jobs from the CLI
pnpm auth:generate       # Generate Better Auth artifacts
pnpm auth:migrate        # Run Better Auth migrations
```

## Deployment

The repository includes `netlify.toml` and uses `@netlify/vite-plugin-tanstack-start`. Server functions and API routes run through Netlify Functions.

Before deploying, configure production values for the variables in `.env.example` plus any WooCommerce and Bunny storage secrets required by the target environment.
