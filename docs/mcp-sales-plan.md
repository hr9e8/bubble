# Sales MCP Plan

## Goal

Give owners and managers a safe way to ask AI clients for sales dashboard answers without exposing raw database access.

## Current implementation

The first MCP server is read-only and runs over stdio:

```bash
DATABASE_URL="postgres://..." MCP_USER_EMAIL="boss@example.com" pnpm mcp:sales
```

Use `MCP_USER_ID` instead of `MCP_USER_EMAIL` if an exact user id is preferred.

The MCP identity is resolved from `auth_users`, then normal dashboard permissions and sales scope are applied:

- `orders:all` can see all orders.
- `orders:team` can see own orders plus active managed sales members.
- other users are limited to own orders.

## Tools

- `get_sales_overview`
  - Inputs: `dateFrom`, `dateTo`, optional `statuses`
  - Returns: revenue, average order value, number of orders, units sold

- `get_sales_trend`
  - Inputs: `dateFrom`, `dateTo`, optional `statuses`, `bucket` of `day`, `week`, or `month`
  - Returns: revenue, AOV, and orders per bucket

- `get_product_velocity`
  - Inputs: `dateFrom`, `dateTo`, optional `statuses`, `direction` of `fast` or `slow`, `limit`
  - Returns: products sold in the period ranked by units sold

Default statuses are `pending_payment`, `finance_hold`, `verified`, `packing`, and `shipped`.

## Next phases

1. Add saved dashboard view specs.
   - AI should create JSON view drafts, not raw frontend code.
   - Humans approve before saving.

2. Add channel adapters.
   - Telegram and WhatsApp bots should call the same analytics service.
   - Bot replies can include summaries plus links back to saved dashboard views.

3. Add audit logging.
   - Log the MCP user, tool name, input range, output row counts, and client metadata if available.

4. Add stronger business definitions.
   - Confirm whether revenue should include pending orders.
   - Decide whether AOV excludes cancelled/refunded/manual review orders.
   - Decide whether slow-moving products should include active products with zero sales.

5. Add write tools only after approval flows exist.
   - Draft report.
   - Draft dashboard view.
   - Create alert rule.
   - Send approved summary to Telegram/WhatsApp.
