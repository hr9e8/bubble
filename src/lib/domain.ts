import {
  Banknote,
  Boxes,
  ClipboardCheck,
  ContactRound,
  LayoutDashboard,
  Package,
  PackageCheck,
  Plug,
  ReceiptText,
  Settings,
  Settings2,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'

export type AppRole =
  | 'admin'
  | 'sales_team'
  | 'sales_leader'
  | 'finance'
  | 'warehouse_manager'

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'finance_hold'
  | 'verified'
  | 'packing'
  | 'shipped'
  | 'cancelled'

export type StockMovementType =
  | 'initial_import'
  | 'admin_assign'
  | 'leader_transfer_out'
  | 'leader_transfer_in'
  | 'warehouse_receive'
  | 'warehouse_adjustment'
  | 'order_reserve'
  | 'order_release'
  | 'order_fulfill'
  | 'order_cancel'
  | 'manual_correction'

export type NavigationItem = {
  href: string
  label: string
  icon: LucideIcon
  children?: Array<NavigationChildItem>
}

export type NavigationChildItem = {
  href: string
  label: string
  detail: string
  icon: LucideIcon
}

export const navigationItems: Array<NavigationItem> = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/admin',
    label: 'Admin',
    icon: Settings,
    children: [
      {
        label: 'Products',
        detail: 'Product parity fields, categories, images, supplier data, visibility, and reorder levels.',
        href: '/admin/products',
        icon: Package,
      },
      {
        label: 'Pricing',
        detail: 'Retail, distributor, bundle, price-list, and product-credit controls.',
        href: '/admin/pricing',
        icon: ReceiptText,
      },
      {
        label: 'Shipping',
        detail: 'Countries, states, zones, COD rates, couriers, and shipping matrices.',
        href: '/admin/shipping',
        icon: Truck,
      },
      {
        label: 'Users',
        detail: 'App profiles, role assignment, platform links, sales leaders, and warehouse relations.',
        href: '/admin/users',
        icon: Users,
      },
      {
        label: 'Roles and permissions',
        detail: 'Define role permission grants and audit-sensitive administrative access.',
        href: '/admin/roles',
        icon: ShieldCheck,
      },
      {
        label: 'Couriers',
        detail: 'Courier directory, account IDs, tracking URLs, and AWB references.',
        href: '/admin/couriers',
        icon: Truck,
      },
      {
        label: 'Platforms',
        detail: 'Sales platforms, warehouse platforms, website owners, and order prefixes.',
        href: '/admin/platforms',
        icon: Settings2,
      },
      {
        label: 'Stock setup',
        detail: 'Lots, balances, warehouses, movement ledger, and controlled assignment.',
        href: '/admin/stocks',
        icon: Boxes,
      },
      {
        label: 'Warehouses',
        detail: 'Warehouse platforms, user relations, stock locations, and fulfillment ownership.',
        href: '/admin/warehouses',
        icon: Truck,
      },
      {
        label: 'WooCommerce',
        detail: 'Connect stores, test reachability, queue imports, and receive webhooks.',
        href: '/admin/woocommerce',
        icon: Plug,
      },
      {
        label: 'Migration',
        detail: 'Run Bubble CSV profiling, raw staging, transforms, and reconciliation checks.',
        href: '/admin/migration',
        icon: Upload,
      },
    ],
  },
  { href: '/orders', label: 'Order', icon: ShoppingCart },
  { href: '/customers', label: 'Customers', icon: ContactRound },
  { href: '/stock', label: 'Stock', icon: Boxes },
  { href: '/finance', label: 'Finance', icon: Banknote },
  { href: '/warehouse', label: 'Warehouse', icon: Warehouse },
]

export const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  sales_team: 'Sales Team',
  sales_leader: 'Sales Leader',
  finance: 'Finance',
  warehouse_manager: 'Warehouse Manager',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: 'Draft',
  pending_payment: 'Pending payment',
  finance_hold: 'Finance hold',
  verified: 'Verified',
  packing: 'Packing',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
}

export const dashboardStats = [
  { label: 'Orders migrated', value: 24802, delta: 'Bubble source', icon: ClipboardCheck },
  { label: 'Pending finance', value: 186, delta: 'Needs manual check', icon: Banknote },
  { label: 'Low stock SKUs', value: 42, delta: 'Below reorder level', icon: PackageCheck },
  { label: 'Ready to pack', value: 314, delta: 'Verified orders', icon: Truck },
]

export const monthlySales = [
  { month: 'Jan', orders: 1220, revenue: 184200 },
  { month: 'Feb', orders: 1384, revenue: 209340 },
  { month: 'Mar', orders: 1610, revenue: 251780 },
  { month: 'Apr', orders: 1468, revenue: 232110 },
  { month: 'May', orders: 1788, revenue: 284950 },
  { month: 'Jun', orders: 1904, revenue: 309420 },
]

export const adminTasks = [
  { name: 'Users and roles', count: 5, detail: 'Admin, Sales Team, Sales Leader, Finance, Warehouse' },
  { name: 'Product catalog', count: 8, detail: 'Products, categories, bundles, prices, credits' },
  { name: 'Shipping setup', count: 7, detail: 'Countries, states, zones, couriers, COD rates' },
  { name: 'Stock setup', count: 4, detail: 'Lots, balances, warehouses, movement ledger' },
]

export const orderPipeline = [
  { status: 'Pending payment', count: 186 },
  { status: 'Verified', count: 314 },
  { status: 'Packing', count: 142 },
  { status: 'Shipped today', count: 91 },
]

export const stockMovements = [
  { type: 'Admin assign', product: 'SKU-KOPI-001', quantity: 120, owner: 'Aina Sales' },
  { type: 'Order reserve', product: 'SKU-KURMA-004', quantity: -3, owner: 'Farid Team' },
  { type: 'Leader transfer', product: 'SKU-MADU-009', quantity: 25, owner: 'Mira Sales' },
  { type: 'Warehouse receive', product: 'SKU-SERUM-012', quantity: 500, owner: 'KL Warehouse' },
]

export const migrationStages = [
  { name: 'CSV profiling', state: 'Scripted' },
  { name: 'Raw import', state: 'Scripted' },
  { name: 'Normalized transform', state: 'Scripted' },
  { name: 'Reconciliation', state: 'Scripted' },
]
