# Bubble App Style Guide

This app follows a Shopify App Home / Polaris-inspired admin style. The goal is not to copy Shopify HTML tags directly, but to keep every new page and component aligned with the same layout, spacing, hierarchy, and interaction rules.

Primary references:

- Shopify App Home web components: https://shopify.dev/docs/api/app-home/web-components
- App Bridge web components: https://shopify.dev/docs/api/app-home/app-bridge-web-components
- Page: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/page
- Box: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/box
- Grid: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/grid
- Query container: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/query-container
- Section: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/section
- Stack: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/stack
- Table: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/table
- Divider: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/divider
- Ordered list: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/ordered-list
- Unordered list: https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/unordered-list
- Button: https://shopify.dev/docs/api/app-home/web-components/actions/button
- Clickable: https://shopify.dev/docs/api/app-home/web-components/actions/clickable
- Link: https://shopify.dev/docs/api/app-home/web-components/actions/link
- Menu: https://shopify.dev/docs/api/app-home/web-components/actions/menu
- Banner: https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/banner
- Text field: https://shopify.dev/docs/api/app-home/web-components/forms/text-field
- Search field: https://shopify.dev/docs/api/app-home/web-components/forms/search-field
- Select: https://shopify.dev/docs/api/app-home/web-components/forms/select
- Checkbox: https://shopify.dev/docs/api/app-home/web-components/forms/checkbox
- Choice list: https://shopify.dev/docs/api/app-home/web-components/forms/choice-list
- Switch: https://shopify.dev/docs/api/app-home/web-components/forms/switch
- Text area: https://shopify.dev/docs/api/app-home/web-components/forms/text-area
- Image: https://shopify.dev/docs/api/app-home/web-components/media-and-visuals/image
- Thumbnail: https://shopify.dev/docs/api/app-home/web-components/media-and-visuals/thumbnail
- Modal: https://shopify.dev/docs/api/app-home/web-components/overlays/modal
- Popover: https://shopify.dev/docs/api/app-home/web-components/overlays/popover
- Title bar: https://shopify.dev/docs/api/app-home/app-bridge-web-components/title-bar
- Save bar API: https://shopify.dev/docs/api/app-home/apis/user-interface-and-interactions/save-bar-api

## Core Principle

Use Shopify-style admin patterns: quiet surfaces, tight spacing, clear action hierarchy, restrained color, visible labels, and predictable grouping.

Do not invent one-off card styles, button colors, or form treatments inside route files. Use the primitives in `src/styles.css` first. Add a new primitive only when the same pattern will be reused.

## Coverage Target

The target visual match is about 90% Shopify Admin / App Home. That means:

- Use Shopify-style structure and spacing by default.
- Use Shopify-like component roles and names even though this app uses React/Tailwind classes.
- Prefer neutral surfaces, compact controls, and semantic status tones.
- Avoid custom visual systems unless the product requirement clearly needs one.

Every new component should map to one of these patterns before custom CSS is considered:

| Shopify concept | Local class or pattern |
| --- | --- |
| Homepage / app home | `page-template-home`, `app-page`, `section-card`, `metric-row` |
| Index / resource index | `page-template-index`, `table-card`, `data-table`, `resource-list` |
| Checkout-like workflow | `page-template-checkout`, `section-card`, `save-bar`, `app-stack` |
| Detail page | `page-template-detail`, `title-bar`, `section-card`, aside `section-card` |
| Settings page | `page-template-settings`, `section-card`, `form-field`, `switch-control` |
| Forms | `form-field`, `form-label`, `form-input`, `form-select`, `form-textarea`, `choice-row` |
| Buttons | `polaris-button` variants |
| Tooltips | `tooltip-surface` |
| Modal | `modal-backdrop`, `modal-panel`, `modal-header`, `modal-body`, `modal-footer` |
| Popover / menu | `popover-surface`, `popover-action` |
| Graphs / charts | `chart-card`, `chart-header`, existing `ChartContainer` |
| Callout card | `callout-card` |
| Empty state | `empty-state`, `empty-state-body` |
| Media card | `media-card`, `media-card-image`, `media-card-body`, `thumbnail` |
| Metrics card | `metric-card`, `metric-row`, `metric-label`, `metric-value` |
| Resource list | `resource-list`, `resource-item`, `resource-item-main` |
| Feedback | `feedback-banner` tone variants |
| Status indicator | `status-indicator` tone variants or `Badge` |
| Box | `app-box`, `app-box-subdued` |
| Grid | `app-grid`, `app-grid-2`, `app-grid-3`, `app-grid-4` |
| Divider | `app-divider`, `app-divider-vertical` |
| Ordered list | `app-list-ordered` |
| Unordered list | `app-list` |
| Page | `app-page`, `page-header`, `page-header-row` |
| Query container | `query-container` |
| Section | `section-card` |
| Stack | `app-stack`, `app-stack-inline` |
| Table | `table-card`, `data-table` |
| App nav | `app-nav`, `app-nav-link`, `app-nav-link-active` |
| Loading bar | `loading-bar` |
| Save bar | `save-bar`, `save-bar-message` |
| Title bar | `title-bar`, `title-bar-actions` |

## Design Tokens

Use these values unless a component has a specific reason to differ.

| Purpose | Value |
| --- | --- |
| App background | `#f1f1f1` |
| Surface | `#ffffff` |
| Text | `#202223` |
| Muted text | `#616161` |
| Border | `#dedede` |
| Strong control border | `#8a8a8a` |
| Subtle fill | `#ebebeb` |
| Primary green | `#008060` |
| Primary hover | `#006e52` |
| Focus ring | `#005bd3` |
| Critical | `#d72c0d` |
| Radius | `0.5rem` controls, `0.75rem` panels |
| Elevation | Prefer `0 1px 0 rgba(0, 0, 0, 0.04)` |

Typography uses the app system stack from `src/styles.css`. Keep text compact: page titles are `1.25rem`, section headings are `0.875rem`, helper text is `0.8125rem` or `0.875rem`.

## Page Layout

Shopify's `Page` component is the model: one page wrapper, one heading area, organized content below it.

Use:

```tsx
<div className="app-page">
  <section className="page-header-row">
    <div>
      <h1 className="page-title">Orders</h1>
      <p className="page-description">Manage and view orders from all platforms.</p>
    </div>
    <button className="polaris-button polaris-button-primary">Export</button>
  </section>

  <section className="section-card">...</section>
</div>
```

Rules:

- Use `app-page` as the outer route wrapper.
- Use `page-header` for simple title pages.
- Use `page-header-row` when the page has primary or secondary actions.
- Keep page descriptions short, factual, and merchant-facing.
- Place the primary action on the right on desktop and directly below the heading on mobile.

## Page Patterns

Use these route templates before inventing a new page structure.

Homepage / app home:

```tsx
<div className="page-template-home">
  <section className="page-header-row">...</section>
  <section className="metric-row">
    <article className="metric-card">...</article>
  </section>
  <section className="app-grid-2">
    <div className="chart-card">...</div>
    <aside className="section-card">...</aside>
  </section>
</div>
```

Index / resource page:

```tsx
<div className="page-template-index">
  <section className="page-header-row">...</section>
  <section className="section-card">filters...</section>
  <section className="table-card">
    <div className="overflow-x-auto">
      <table className="data-table">...</table>
    </div>
  </section>
</div>
```

Detail page:

```tsx
<div className="page-template-detail">
  <main className="app-stack">
    <section className="section-card">Primary details</section>
    <section className="section-card">Related records</section>
  </main>
  <aside className="app-stack">
    <section className="section-card">Status</section>
    <section className="section-card">Metadata</section>
  </aside>
</div>
```

Settings page:

```tsx
<div className="page-template-settings">
  <main className="app-stack">
    <section className="section-card">
      <label className="form-field">...</label>
    </section>
  </main>
  <aside className="section-card">Help or summary</aside>
</div>
```

Checkout-like workflow:

```tsx
<div className="page-template-checkout">
  <main className="app-stack">
    <section className="section-card">Step content</section>
  </main>
  <aside className="section-card">Summary</aside>
</div>
```

Rules:

- Homepages emphasize metrics, setup progress, charts, and next actions.
- Index pages use filters plus `table-card` or `resource-list`.
- Detail pages use main content plus a right aside on desktop.
- Settings pages use grouped forms and switches, never loose controls floating on the page.
- Checkout-like workflows use a summary aside and clear save/continue actions.
- Use `title-bar` for page context when mimicking Shopify Admin chrome; use `page-header-row` inside the app content area.

## Sections And Surfaces

Shopify's `Section` groups related content into thematic blocks. Use our card primitives for the same purpose.

Use:

- `section-card` for grouped content, forms, filters, workflows, and side panels.
- `metric-card` for compact dashboard numbers.
- `table-card` for resource tables.
- `list-row` for repeated rows inside cards.
- `app-box` when you need a generic Shopify `Box`-like container.
- `app-box-subdued` for low-emphasis nested content.
- `callout-card` for a small instructional card with actions.
- `app-divider` for separation inside a section when a new heading would be too heavy.

Avoid:

- Nesting cards inside cards unless the nested item is a repeated row.
- Decorative shadows or custom gradients.
- One-off rounded panels with custom border colors.

## Layout Utilities

Shopify uses `Stack`, `Grid`, and `Box`. In this app, use Tailwind layout utilities with the same intent.

Use stack-like layouts for linear groups:

```tsx
<div className="flex flex-col gap-4">...</div>
<div className="flex flex-wrap items-center gap-3">...</div>
```

Use grid-like layouts for cards and settings:

```tsx
<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">...</section>
```

Rules:

- Default gap is `gap-4`.
- Dense inline controls may use `gap-3`.
- Use `app-stack` and `app-stack-inline` when the pattern repeats.
- Use `app-grid-2`, `app-grid-3`, or `app-grid-4` for common responsive card grids.
- Wrap components in `query-container` when their layout should respond to parent width instead of viewport width.
- Do not use viewport-scaled font sizes.
- Do not use marketing-page spacing or large hero sections in app routes.

Example:

```tsx
<div className="query-container">
  <div className="app-grid-3">
    <div className="app-box">Content</div>
    <div className="app-box">Content</div>
    <div className="app-box">Content</div>
  </div>
</div>
```

## Text

Use existing text classes:

- `page-title` for the route title.
- `page-description` for route summary text.
- `section-heading` for section titles.
- `section-muted` for helper, description, secondary metadata.
- `metric-label` and `metric-value` for dashboard metrics.

Text rules:

- Use sentence case.
- Prefer clear nouns and verbs over marketing copy.
- Helper text explains consequences or format, not obvious UI behavior.
- Error text must say how to fix the problem.

## Title Bar, App Nav, Loading Bar, Save Bar

Shopify App Bridge handles these at the admin shell level. In this app, use local approximations when building a native-feeling shell or embedded workflow.

Title bar:

```tsx
<header className="title-bar">
  <div>
    <h1 className="page-title">Edit order</h1>
    <span className="status-indicator status-indicator-warning">Pending payment</span>
  </div>
  <div className="title-bar-actions">
    <button className="polaris-button polaris-button-secondary">Cancel</button>
    <button className="polaris-button polaris-button-primary">Save</button>
  </div>
</header>
```

Save bar:

```tsx
<div className="save-bar">
  <span className="save-bar-message">Unsaved changes</span>
  <div className="app-stack-inline">
    <button className="polaris-button polaris-button-secondary">Discard</button>
    <button className="polaris-button polaris-button-primary">Save</button>
  </div>
</div>
```

Loading bar:

```tsx
<div className="loading-bar" aria-label="Loading" />
```

Rules:

- Title bar actions mirror page-level actions. Do not duplicate conflicting actions in both title bar and page header.
- Save bar appears only when there are unsaved changes.
- Save bar copy should be brief: `Unsaved changes`, `Unsaved order`, `Unsaved settings`.
- Loading bar is for route transitions or long background refreshes, not every button click.
- App navigation uses `app-nav`, `app-nav-link`, and `app-nav-link-active`.

## Buttons

Shopify button guidance separates hierarchy by variant and tone. Use these classes:

- `polaris-button polaris-button-primary` for the main page or modal action.
- `polaris-button polaris-button-secondary` for supporting actions.
- `polaris-button polaris-button-tertiary` for low-emphasis toolbar/menu actions.
- `polaris-button polaris-button-critical` only for destructive actions.

Example:

```tsx
<button className="polaris-button polaris-button-secondary">Cancel</button>
<button className="polaris-button polaris-button-primary">Save product</button>
<button className="polaris-button polaris-button-critical">Delete product</button>
```

Rules:

- Use one primary action per page section or modal.
- Button labels use specific verbs: `Save`, `Export`, `Delete order`, `Transfer stock`.
- Avoid vague labels like `OK`, `Yes`, `Submit`.
- Icon-only buttons need an `aria-label`.
- Use loading and disabled states for async work.

## Links

Use links for navigation or references, not for form submission.

Classes:

- `app-link` for standard links.
- `app-link-neutral` for low-emphasis links.
- `app-link-critical` for destructive navigation or critical support links.

Example:

```tsx
<a className="app-link" href="/orders">View orders</a>
```

## Forms

Shopify form controls always have clear labels, optional help text, and visible validation states. Use native controls with these classes until dedicated React components are introduced.

Text input:

```tsx
<label className="form-field">
  <span className="form-label">Store name</span>
  <input className="form-input" placeholder="Jaded Pixel" />
  <span className="form-help">Use the public-facing store name.</span>
</label>
```

Error state:

```tsx
<label className="form-field">
  <span className="form-label">Order total</span>
  <input className="form-input" aria-invalid="true" />
  <span className="form-error">Enter a valid amount.</span>
</label>
```

Select:

```tsx
<label className="form-field">
  <span className="form-label">Status</span>
  <select className="form-select">
    <option>Pending payment</option>
    <option>Verified</option>
  </select>
</label>
```

Textarea:

```tsx
<label className="form-field">
  <span className="form-label">Internal note</span>
  <textarea className="form-textarea" rows={4} />
</label>
```

Checkbox:

```tsx
<label className="choice-row">
  <input type="checkbox" />
  <span>Send customer notification</span>
</label>
```

Switch:

```tsx
<button className="switch-control" role="switch" aria-checked="true" aria-label="Enable COD" />
```

Rules:

- Labels are required unless an icon-only control has a real `aria-label`.
- Use help text for constraints, examples, or consequences.
- Use `aria-invalid="true"` and an error message together.
- Use checkbox for submitted choices; use switch for settings that take effect immediately.
- Use select for four or more options. Use checkbox/radio style choices for short visible option sets.

Form layout:

```tsx
<section className="section-card">
  <div className="app-stack">
    <label className="form-field">...</label>
    <hr className="app-divider" />
    <label className="choice-row">...</label>
  </div>
</section>
```

Search field:

```tsx
<label className="form-field">
  <span className="form-label sr-only">Search products</span>
  <input className="form-input" type="search" placeholder="Search products" />
</label>
```

Choice list:

```tsx
<fieldset className="form-field">
  <legend className="form-label">Payment method</legend>
  <label className="choice-row"><input type="radio" name="payment" /> Bank transfer</label>
  <label className="choice-row"><input type="radio" name="payment" /> COD</label>
</fieldset>
```

## Badges

Use `Badge` from `src/components/ui/badge.tsx`.

Tones:

- `neutral` for default metadata.
- `success` for completed, enabled, verified, available.
- `warning` for pending, review, packing, partial.
- `danger` for failed, blocked, destructive, hold.
- `info` for informational platform or system labels.

Do not use badges as decoration. They must describe state or metadata.

## Status Indicators And Feedback

Use `Badge` for compact status inside tables and resource lists. Use `status-indicator` when a small dot plus text is enough. Use `feedback-banner` for contextual feedback that needs a full message.

Status indicator:

```tsx
<span className="status-indicator status-indicator-success">Connected</span>
<span className="status-indicator status-indicator-warning">Needs review</span>
<span className="status-indicator status-indicator-critical">Failed</span>
```

Feedback banner:

```tsx
<section className="feedback-banner feedback-banner-warning">
  <h2 className="section-heading">Payment proof required</h2>
  <p className="section-muted">Upload a receipt before finance can verify this order.</p>
</section>
```

Rules:

- Use feedback banners for page or section-level messages.
- Use warning for review or attention, critical for blocking/error states, success for completed changes, and info for neutral guidance.
- Feedback should include a next step when the user can act.

## Tables

Shopify tables are for structured data that benefits from rows and columns, and should adapt on small screens. Use:

```tsx
<section className="table-card">
  <div className="overflow-x-auto">
    <table className="data-table">
      <thead>...</thead>
      <tbody>...</tbody>
    </table>
  </div>
</section>
```

Rules:

- Use `table-card` for all resource lists.
- Use `data-table` for the table element.
- Right-align money and other numeric totals with `.currency` or `.numeric`.
- Keep row actions at the end of the row.
- On mobile, horizontal scroll is acceptable for dense operational tables. For high-volume customer-facing mobile workflows, build a list variant instead.
- Do not fake tables with arbitrary divs unless the content is actually a card list.

## Resource Lists

Use resource lists when the content is scannable as records but does not need strict column comparison.

```tsx
<section className="resource-list">
  <article className="resource-item resource-item-clickable">
    <div className="resource-item-main">
      <img className="thumbnail" src="/product.png" alt="Product" />
      <div>
        <h2 className="section-heading">SKU-KOPI-001</h2>
        <p className="section-muted">Aina Sales</p>
      </div>
    </div>
    <Badge tone="success">Active</Badge>
  </article>
</section>
```

Rules:

- Use `resource-list` for stacked records and mobile-friendly alternatives to tables.
- Use `thumbnail` only when the visual helps identify the resource.
- If the row is clickable, keep the primary destination obvious and preserve keyboard accessibility.

## Cards: Callout, Empty, Media, Metric

Callout card:

```tsx
<section className="callout-card">
  <h2 className="section-heading">Set up shipping zones</h2>
  <p className="section-muted">Configure courier accounts before importing open orders.</p>
  <button className="polaris-button polaris-button-secondary">Configure</button>
</section>
```

Empty state:

```tsx
<section className="empty-state">
  <h2 className="section-heading">No orders found</h2>
  <p className="empty-state-body">Try changing filters or importing a Bubble export.</p>
  <button className="polaris-button polaris-button-primary">Import orders</button>
</section>
```

Media card:

```tsx
<article className="media-card">
  <img className="media-card-image" src="/preview.png" alt="Order manifest preview" />
  <div className="media-card-body">
    <h2 className="section-heading">Latest manifest</h2>
    <p className="section-muted">Generated today.</p>
  </div>
</article>
```

Metrics card:

```tsx
<article className="metric-card">
  <p className="metric-label">Ready to pack</p>
  <p className="metric-value">314</p>
  <p className="section-muted">Verified orders</p>
</article>
```

Rules:

- Callouts prompt one setup or next action.
- Empty states explain what is missing and what to do next.
- Media cards require meaningful images with `alt`; do not use decorative stock imagery.
- Metric cards are for a single number and a short label. For complex analytics, use a chart card.

## Graphs And Charts

Use `chart-card` for analytics blocks and keep chart colors aligned to the guide tokens.

```tsx
<section className="chart-card">
  <div className="chart-header">
    <h2 className="section-heading">Monthly order value</h2>
    <span className="section-muted">RM 1,471,800 tracked</span>
  </div>
  <ChartContainer className="border-0 p-0 shadow-none">...</ChartContainer>
</section>
```

Rules:

- Use green `#008060` for primary series.
- Use muted grays for axes and grid lines.
- Put the chart in a white surface with a compact header.
- Do not add legends unless there are multiple real data series.

## Lists And Dividers

Ordered list:

```tsx
<ol className="app-list-ordered">
  <li>Upload CSV export</li>
  <li>Review staged records</li>
  <li>Run reconciliation</li>
</ol>
```

Unordered list:

```tsx
<ul className="app-list">
  <li>Configure payment settings</li>
  <li>Set up shipping rates</li>
  <li>Add product descriptions</li>
</ul>
```

Divider:

```tsx
<hr className="app-divider" />
```

Rules:

- Use ordered lists for steps or ranked information.
- Use unordered lists for grouped facts where sequence does not matter.
- Keep list items parallel in grammar and length.
- Use dividers to separate related blocks inside a section; use a new section when the topic changes.

## Tooltips

Tooltips are for short, non-essential clarification on hover/focus. Use `tooltip-surface` for the overlay body when implementing a tooltip primitive.

Example overlay body:

```tsx
<div role="tooltip" className="tooltip-surface">
  Last synced 3 minutes ago
</div>
```

Rules:

- Do not put interactive controls inside tooltips.
- Tooltip text should be one short sentence.
- Any icon that relies on a tooltip also needs an accessible label.

## Popovers

Shopify popovers are for contextual actions, filters, and compact settings that do not need full focus. Use `popover-surface` and `popover-action`.

Example:

```tsx
<div className="popover-surface" role="dialog" aria-label="More actions">
  <button className="popover-action">Import</button>
  <button className="popover-action">Export</button>
</div>
```

Rules:

- Trigger popovers from a clearly labeled secondary or tertiary button.
- Keep popovers scoped to one task: actions, filters, notifications, or display settings.
- Use a modal instead when the task needs confirmation, complex form input, or more space.
- Do not open popovers on page load.

## Modals

Shopify modals are for focused decisions, confirmations, settings panels, and structured input that should interrupt the current page.

Use:

```tsx
<div className="modal-backdrop">
  <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-title">
    <header className="modal-header">
      <h2 id="edit-title" className="section-heading">Edit customer information</h2>
    </header>
    <div className="modal-body">
      ...
    </div>
    <footer className="modal-footer">
      <button className="polaris-button polaris-button-secondary">Cancel</button>
      <button className="polaris-button polaris-button-primary">Save</button>
    </footer>
  </section>
</div>
```

Rules:

- Use modals sparingly.
- Do not nest modals.
- Use a clear heading.
- Use one primary action.
- For destructive actions, explain the consequence in the body and use `polaris-button-critical` for the destructive action.
- Modal content may scroll; page content behind it should not be interactive.

## Empty States

Use a `section-card` or dashed panel for empty states. Keep content factual.

Example:

```tsx
<section className="rounded-xl border border-dashed border-[#c9cccf] bg-white p-8 text-center">
  <h2 className="section-heading">Waiting for Bubble CSV zip</h2>
  <p className="section-muted mx-auto mt-1 max-w-xl">Upload an export to stage and inspect records.</p>
</section>
```

Rules:

- State what is missing.
- State the next action.
- Do not add decorative illustration unless it communicates actual content.

## Component Creation Checklist

Before adding a new component or route:

- Does the route use `app-page`?
- Does the header use `page-header` or `page-header-row`?
- Are content groups in `section-card`, `metric-card`, or `table-card`?
- Are actions using `polaris-button` variants?
- Do form controls have labels and error/help states?
- Are overlays using tooltip, popover, or modal based on the task's required focus?
- Are custom colors avoided unless they are already in this guide?
- Is text compact, scannable, and sentence case?
- Does the page work at mobile width without overlapping controls?

## When To Add A New Primitive

Add a new class to `src/styles.css` only when:

- At least two components need the same pattern.
- The pattern maps to a Shopify/Polaris component concept.
- The name describes purpose, not appearance.

Good names:

- `filter-toolbar`
- `resource-list`
- `settings-row`
- `empty-state`

Avoid names:

- `green-box`
- `big-card`
- `fancy-panel`
- `custom-button`
