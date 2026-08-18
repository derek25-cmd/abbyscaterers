import {
  TrendingUp, ShoppingCart, Receipt, Percent, Wallet, CalendarCheck,
  Package, UtensilsCrossed, Truck, PackageCheck, Users, Megaphone, ShieldCheck,
} from 'lucide-react';

export interface ModuleMeta {
  id: string;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  kind: 'business' | 'marketing' | 'system';
}

/** Sidebar catalog for /reports/business — 13 modules covering every data
 * domain in the system, grouped by category, plus the pinned Executive
 * Summary rendered separately by the page. */
export const MODULE_CATALOG: ModuleMeta[] = [
  { id: 'sales-revenue', label: 'Sales & Revenue', category: 'Finance', icon: TrendingUp, kind: 'business' },
  { id: 'purchases', label: 'Purchases & Procurement', category: 'Finance', icon: ShoppingCart, kind: 'business' },
  { id: 'expenses', label: 'Expenses', category: 'Finance', icon: Receipt, kind: 'business' },
  { id: 'tax-compliance', label: 'Tax & Compliance', category: 'Finance', icon: Percent, kind: 'business' },
  { id: 'payroll-hr', label: 'Payroll & Employee Costs', category: 'HR', icon: Wallet, kind: 'business' },
  { id: 'attendance-workforce', label: 'Attendance & Workforce', category: 'HR', icon: CalendarCheck, kind: 'business' },
  { id: 'inventory-stock', label: 'Inventory & Stock', category: 'Operations', icon: Package, kind: 'business' },
  { id: 'menu-costing', label: 'Menu & Costing', category: 'Operations', icon: UtensilsCrossed, kind: 'business' },
  { id: 'assets-equipment', label: 'Assets & Equipment', category: 'Operations', icon: PackageCheck, kind: 'business' },
  { id: 'delivery-fulfillment', label: 'Delivery & Fulfillment', category: 'Operations', icon: Truck, kind: 'business' },
  { id: 'clients', label: 'Clients', category: 'Sales', icon: Users, kind: 'business' },
  { id: 'marketing-crm', label: 'Marketing & CRM', category: 'Sales', icon: Megaphone, kind: 'marketing' },
  { id: 'audit-system', label: 'Audit & System', category: 'System', icon: ShieldCheck, kind: 'system' },
];

export const MODULE_CATEGORIES = Array.from(new Set(MODULE_CATALOG.map((m) => m.category)));
