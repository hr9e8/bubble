export type BubbleSource = {
  entityName: string
  canonicalFile: string
  variantFiles?: Array<string>
  idColumn?: string
  slugColumn?: string
  relationshipColumns?: Record<string, string>
}

export const bubbleSources: Array<BubbleSource> = [
  {
    entityName: 'users',
    canonicalFile: 'All Users-modified 2.csv',
    variantFiles: ['All Users Modified.csv', 'All Users.csv'],
    idColumn: 'unique id',
    relationshipColumns: {
      'Warehouse Relation': 'warehouse_user_relations',
      'Platform Sales Team': 'sales_team_platforms',
    },
  },
  {
    entityName: 'bundle_line_items',
    canonicalFile: 'Bundle-Line-Items.csv',
    relationshipColumns: {
      'Bundle Product': 'products.product_code',
      Product: 'products.product_code',
    },
  },
  {
    entityName: 'customers',
    canonicalFile: 'Customers.csv',
    relationshipColumns: {
      CountryRelated: 'shipping_countries.legacy_bubble_id',
      Note: 'notes.legacy_bubble_id',
      OrderRelated: 'orders.order_number',
    },
  },
  {
    entityName: 'notes',
    canonicalFile: 'Notes.csv',
    relationshipColumns: {
      'Related Order': 'orders.order_number',
      'Related Customer': 'customers.legacy_bubble_id',
    },
  },
  {
    entityName: 'order_cart_line_items',
    canonicalFile: 'Order-Cart-Line-Items.csv',
    relationshipColumns: {
      BundleParent: 'products.product_code',
      Product: 'products.product_code',
    },
  },
  {
    entityName: 'order_line_items',
    canonicalFile: 'Order-Line-Items.csv',
    relationshipColumns: {
      Order: 'orders.order_number',
      Product: 'products.product_code',
      BundleParent: 'products.product_code',
      OrderDistributor: 'users.legacy_bubble_id',
    },
  },
  {
    entityName: 'order_manifests',
    canonicalFile: 'Order-Manifests.csv',
    relationshipColumns: {
      Order: 'orders.order_number',
    },
  },
  {
    entityName: 'order_website_owners',
    canonicalFile: 'Order-Website-Owners.csv',
    slugColumn: 'Slug',
    relationshipColumns: {
      user: 'users.name',
    },
  },
  {
    entityName: 'orders',
    canonicalFile: 'data-example-2/Orders-Column.csv',
    variantFiles: ['Orders.csv', 'data-example-2/Orders-modified.csv'],
    idColumn: 'unique id',
    relationshipColumns: {
      CreatedBy: 'users.name',
      'Order items': 'order_line_items.legacy_bubble_id',
      Platform: 'sales_team_platforms.name',
      'Shipping Rate Related': 'shipping_rates.legacy_bubble_id',
      Tag: 'tags.legacy_bubble_id',
      'Tracking Account ID': 'shipping_accounts.legacy_bubble_id',
      'Tracking Courier Data': 'shipping_couriers.legacy_bubble_id',
    },
  },
  {
    entityName: 'product_credit_rates',
    canonicalFile: 'Product-Credit-Rates.csv',
    slugColumn: 'Slug',
  },
  {
    entityName: 'product_credits',
    canonicalFile: 'Product-Credits.csv',
    slugColumn: 'Slug',
    relationshipColumns: {
      Product: 'products.product_code',
    },
  },
  {
    entityName: 'products',
    canonicalFile: 'data-example-2/Products-modified-copied.csv',
    variantFiles: ['Products.csv', 'data-example-2/Products-modified_copied.csv'],
    idColumn: 'unique id',
    relationshipColumns: {
      'Bundle Line Item': 'bundle_line_items.legacy_bubble_id',
    },
  },
  {
    entityName: 'sales_team_platforms',
    canonicalFile: 'Sales-Team-Platforms.csv',
    relationshipColumns: {
      Stock: 'stocks.legacy_bubble_id',
    },
  },
  {
    entityName: 'shipping_accounts',
    canonicalFile: 'Shipping-Account-IDS.csv',
    relationshipColumns: {
      CourierData: 'shipping_couriers.legacy_bubble_id',
    },
  },
  {
    entityName: 'shipping_countries',
    canonicalFile: 'Shipping-Countries.csv',
    relationshipColumns: {
      'Shipping States': 'shipping_states.legacy_bubble_id',
    },
  },
  {
    entityName: 'shipping_couriers',
    canonicalFile: 'Shipping-Couriers.csv',
    slugColumn: 'Slug',
  },
  {
    entityName: 'shipping_rates',
    canonicalFile: 'Shipping-Methods-modified-copied.csv',
    variantFiles: ['Shipping-Rates.csv', 'Shipping-Methods-modified.csv'],
    idColumn: 'unique id',
    relationshipColumns: {
      'Shipping Zone': 'shipping_zones.legacy_bubble_id',
    },
  },
  {
    entityName: 'shipping_cod_rates',
    canonicalFile: 'Shipping-Rate-CODS-modified-copied.csv',
    variantFiles: ['Shipping-Rate-CODS.csv', 'Shipping-Rate-CODS-modified.csv'],
    idColumn: 'unique id',
    relationshipColumns: {
      'Shipping Zone': 'shipping_zones.legacy_bubble_id',
    },
  },
  {
    entityName: 'shipping_states',
    canonicalFile: 'Shipping-States-copied.csv',
    variantFiles: ['Shipping-States.csv'],
    idColumn: 'unique id',
    slugColumn: 'Slug',
    relationshipColumns: {
      'Shipping Country': 'shipping_countries.legacy_bubble_id',
    },
  },
  {
    entityName: 'shipping_zones',
    canonicalFile: 'Shipping-Zones-modified.csv',
    variantFiles: ['Shipping-Zones.csv'],
    idColumn: 'unique id',
    relationshipColumns: {
      Country: 'shipping_countries.legacy_bubble_id',
      States: 'shipping_states.legacy_bubble_id',
      'Shipping Rate': 'shipping_rates.legacy_bubble_id',
      'Shipping COD Rate': 'shipping_cod_rates.legacy_bubble_id',
      'Apply Products': 'products.product_code',
    },
  },
  {
    entityName: 'stock_movements',
    canonicalFile: 'Stock-Movements-modified.csv',
    variantFiles: ['Stock-Movements.csv'],
    relationshipColumns: {
      Order: 'orders.order_number',
      'Product Data': 'products.product_code',
      'User Related': 'users.name',
      Warehouse: 'warehouse_platforms.name',
    },
  },
  {
    entityName: 'stock_warehouses',
    canonicalFile: 'Stock-Warehouses.csv',
    relationshipColumns: {
      Product: 'products.product_code',
      'Warehouse Platform': 'warehouse_platforms.name',
    },
  },
  {
    entityName: 'stocks',
    canonicalFile: 'Stocks-modified-copied.csv',
    variantFiles: ['Stocks.csv', 'Stocks-modified.csv', 'Stocks-modified-copied 2.csv'],
    relationshipColumns: {
      'Owner/Receiver': 'users.name',
      Product: 'products.product_code',
      'Stock Platform': 'sales_team_platforms.name',
      'Warehouse Platform': 'warehouse_platforms.name',
    },
  },
  {
    entityName: 'tags',
    canonicalFile: 'Tags.csv',
    slugColumn: 'Slug',
  },
  {
    entityName: 'warehouse_platforms',
    canonicalFile: 'Warehouse-Platforms.csv',
    slugColumn: 'Slug',
  },
  {
    entityName: 'warehouse_user_relations',
    canonicalFile: 'Warehouse-User-Relations.csv',
    slugColumn: 'Slug',
    relationshipColumns: {
      User: 'users.name',
      warehouse: 'warehouse_platforms.name',
    },
  },
]

export function splitBubbleList(value: string | undefined) {
  if (!value) return []

  return value
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}
