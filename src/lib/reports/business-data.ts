import type {
  Sale, Invoice, ProformaInvoice, Order, Booking, Purchase, Expense, Payroll,
  Employee, Attendance, Product, StockLog, Ingredient, Issuance, Recipe,
  CateringMenu, Asset, DeliveryNote, Client,
} from '@/types';
import type { ModuleReportData } from './types';
import { inPeriod, type PeriodRange } from './periods';
import { sum, groupSum, groupCount, kpi, toRows } from './aggregate-helpers';
import { calcInvoiceTotals } from './invoice-math';

export interface RawDatasets {
  sales: Sale[];
  invoices: Invoice[];
  proformaInvoices: ProformaInvoice[];
  orders: Order[];
  bookings: Booking[];
  purchases: Purchase[];
  expenses: Expense[];
  payrolls: Payroll[];
  employees: Employee[];
  attendance: Attendance[];
  products: Product[];
  stockLogs: StockLog[];
  ingredients: Ingredient[];
  issuances: Issuance[];
  recipes: Recipe[];
  cateringMenus: CateringMenu[];
  assets: Asset[];
  deliveryNotes: DeliveryNote[];
  clients: Client[];
}

const inRange = (d: string | null | undefined, r: PeriodRange) => inPeriod(d, r.from, r.to);
const inPrevRange = (d: string | null | undefined, r: PeriodRange) => inPeriod(d, r.prevFrom, r.prevTo);

// ── 1. Sales & Revenue ──────────────────────────────────────────────────────
export function aggregateSalesRevenue(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const sales = raw.sales.filter((s) => inRange(s.date, range));
  const prevSales = raw.sales.filter((s) => inPrevRange(s.date, range));
  const invoices = raw.invoices.filter((i) => inRange(i.invoiceDate, range));
  const prevInvoices = raw.invoices.filter((i) => inPrevRange(i.invoiceDate, range));
  const bookings = raw.bookings.filter((b) => inRange(b.start_date, range));
  const proformas = raw.proformaInvoices.filter((p) => inRange(p.invoiceDate, range));

  const salesTotal = sum(sales, (s) => s.totalAmount);
  const prevSalesTotal = sum(prevSales, (s) => s.totalAmount);
  const invoicedTotal = sum(invoices, (i) => calcInvoiceTotals(i).grandTotal);
  const prevInvoicedTotal = sum(prevInvoices, (i) => calcInvoiceTotals(i).grandTotal);
  const outstanding = invoices.filter((i) => i.status === 'outstanding' || i.status === 'partially paid');

  return {
    moduleId: 'sales-revenue',
    moduleLabel: 'Sales & Revenue',
    kpis: [
      kpi('Direct Sales Revenue', salesTotal, 'currency', prevSalesTotal),
      kpi('Invoiced Revenue', invoicedTotal, 'currency', prevInvoicedTotal),
      kpi('Outstanding Invoices', outstanding.length, 'number'),
      kpi('New Bookings', bookings.length, 'number'),
      kpi('Proforma Invoices Issued', proformas.length, 'number'),
      kpi('Orders Created', raw.orders.filter((o) => inRange(o.createdAt, range)).length, 'number'),
    ],
    tables: [
      {
        title: 'Invoices by Status',
        columns: ['Status', 'Count', 'Value (TZS)'],
        rows: groupCount(invoices, (i) => i.status).map((g) => [
          g.name,
          g.value,
          sum(invoices.filter((i) => i.status === g.name), (i) => calcInvoiceTotals(i).grandTotal),
        ]),
      },
      {
        title: 'Sales by Payment Status',
        columns: ['Payment Status', 'Count', 'Total (TZS)'],
        rows: groupSum(sales, (s) => s.paymentStatus, (s) => s.totalAmount).map((g) => [g.name, sales.filter((s) => s.paymentStatus === g.name).length, g.value]),
      },
    ],
    charts: [{ title: 'Invoice Status Split', type: 'pie', data: groupCount(invoices, (i) => i.status) }],
  };
}

// ── 2. Purchases & Procurement ──────────────────────────────────────────────
export function aggregatePurchases(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const purchases = raw.purchases.filter((p) => inRange(p.date, range));
  const prevPurchases = raw.purchases.filter((p) => inPrevRange(p.date, range));
  const total = sum(purchases, (p) => p.totalCost);
  const prevTotal = sum(prevPurchases, (p) => p.totalCost);
  const unpaid = purchases.filter((p) => p.paymentStatus === 'unpaid');

  return {
    moduleId: 'purchases',
    moduleLabel: 'Purchases & Procurement',
    kpis: [
      kpi('Total Purchases', total, 'currency', prevTotal),
      kpi('Input Tax Paid', sum(purchases, (p) => p.taxAmount || 0), 'currency'),
      kpi('Unpaid Purchases (Value)', sum(unpaid, (p) => p.totalCost), 'currency'),
      kpi('Purchase Transactions', purchases.length, 'number', prevPurchases.length),
    ],
    tables: [
      {
        title: 'Top Suppliers by Spend',
        columns: ['Supplier', 'TIN', 'Transactions', 'Total (TZS)'],
        rows: groupSum(purchases, (p) => p.supplier, (p) => p.totalCost).slice(0, 10).map((g) => [
          g.name,
          purchases.find((p) => p.supplier === g.name)?.supplier_tin || '—',
          purchases.filter((p) => p.supplier === g.name).length,
          g.value,
        ]),
      },
      {
        title: 'By Expense Category',
        columns: ['Category', 'Total (TZS)'],
        rows: groupSum(purchases, (p) => p.expenseCategory, (p) => p.totalCost).map((g) => [g.name, g.value]),
      },
    ],
    charts: [{ title: 'Spend by Category', type: 'pie', data: groupSum(purchases, (p) => p.expenseCategory, (p) => p.totalCost) }],
  };
}

// ── 3. Expenses ──────────────────────────────────────────────────────────────
export function aggregateExpenses(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const expenses = raw.expenses.filter((e) => inRange(e.date, range));
  const prevExpenses = raw.expenses.filter((e) => inPrevRange(e.date, range));
  const total = sum(expenses, (e) => e.amount);
  const prevTotal = sum(prevExpenses, (e) => e.amount);
  const byCategory = groupSum(expenses, (e) => e.category, (e) => e.amount);

  return {
    moduleId: 'expenses',
    moduleLabel: 'Expenses',
    kpis: [
      kpi('Total Expenses', total, 'currency', prevTotal),
      kpi('VAT on Expenses', sum(expenses, (e) => e.vat_amount || 0), 'currency'),
      kpi('Top Category', byCategory[0]?.value || 0, 'currency'),
      kpi('Expense Entries', expenses.length, 'number', prevExpenses.length),
    ],
    tables: [
      { title: 'Expenses by Category', columns: ['Category', 'Total (TZS)'], rows: byCategory.map((g) => [g.name, g.value]) },
      {
        title: 'Expenses by Payment Method',
        columns: ['Method', 'Total (TZS)'],
        rows: groupSum(expenses, (e) => e.payment_md, (e) => e.amount).map((g) => [g.name, g.value]),
      },
    ],
    charts: [{ title: 'Expenses by Category', type: 'pie', data: byCategory }],
  };
}

// ── 4. Tax & Compliance ──────────────────────────────────────────────────────
export function aggregateTaxCompliance(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const invoices = raw.invoices.filter((i) => inRange(i.invoiceDate, range));
  const purchases = raw.purchases.filter((p) => inRange(p.date, range));
  const expenses = raw.expenses.filter((e) => inRange(e.date, range));
  const payrolls = raw.payrolls.filter((p) => inRange(p.paymentDate || p.payPeriodEnd, range));

  const outputVAT = sum(invoices, (i) => calcInvoiceTotals(i).vatAmount);
  const inputVATPurchases = sum(purchases, (p) => p.taxAmount || 0);
  const inputVATExpenses = sum(expenses, (e) => e.vat_amount || 0);
  const netVAT = outputVAT - inputVATPurchases - inputVATExpenses;
  const payeAccrued = sum(payrolls, (p) => p.paye_amount || 0);
  const venueRentWHT = sum(expenses.filter((e) => e.category === 'Venue Rent'), (e) => e.amount * 0.05);

  return {
    moduleId: 'tax-compliance',
    moduleLabel: 'Tax & Compliance',
    kpis: [
      kpi('Output VAT (Sales)', outputVAT, 'currency'),
      kpi('Input VAT (Purchases + Expenses)', inputVATPurchases + inputVATExpenses, 'currency'),
      kpi('Net VAT Liability', netVAT, 'currency'),
      kpi('PAYE Accrued', payeAccrued, 'currency'),
      kpi('WHT on Venue Rent (5%)', venueRentWHT, 'currency'),
    ],
    tables: [
      {
        title: 'VAT Position',
        columns: ['Line', 'Amount (TZS)'],
        rows: [
          ['Output VAT — Sales Invoices', outputVAT],
          ['Input VAT — Purchases', inputVATPurchases],
          ['Input VAT — Expenses', inputVATExpenses],
          ['Net VAT Liability', netVAT],
        ],
      },
    ],
    charts: [{ title: 'Output vs Input VAT', type: 'pie', data: [{ name: 'Output VAT', value: outputVAT }, { name: 'Input VAT', value: inputVATPurchases + inputVATExpenses }] }],
  };
}

// ── 5. Payroll & Employee Costs ─────────────────────────────────────────────
export function aggregatePayrollHR(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const payrolls = raw.payrolls.filter((p) => inRange(p.paymentDate || p.payPeriodEnd, range));
  const prevPayrolls = raw.payrolls.filter((p) => inPrevRange(p.paymentDate || p.payPeriodEnd, range));
  const netTotal = sum(payrolls, (p) => p.netSalary);
  const prevNetTotal = sum(prevPayrolls, (p) => p.netSalary);
  const employerCost = sum(payrolls, (p) => (p.nssf_employer || 0) + (p.sdl_amount || 0) + (p.wcf_contrib || 0));

  return {
    moduleId: 'payroll-hr',
    moduleLabel: 'Payroll & Employee Costs',
    kpis: [
      kpi('Net Payroll Paid', netTotal, 'currency', prevNetTotal),
      kpi('Gross Payroll', sum(payrolls, (p) => p.grossSalary), 'currency'),
      kpi('Employer Statutory Cost', employerCost, 'currency'),
      kpi('Payslips Processed', payrolls.length, 'number', prevPayrolls.length),
      kpi('Active Employees (current)', raw.employees.filter((e) => e.status === 'Active').length, 'number'),
    ],
    tables: [
      {
        title: 'By Staff Type',
        columns: ['Staff Type', 'Payslips', 'Net Total (TZS)'],
        rows: groupCount(payrolls, (p) => p.staff_type || 'permanent').map((g) => [
          g.name,
          g.value,
          sum(payrolls.filter((p) => (p.staff_type || 'permanent') === g.name), (p) => p.netSalary),
        ]),
      },
      {
        title: 'By Department (current headcount)',
        columns: ['Department', 'Employees'],
        rows: toRows(groupCount(raw.employees.filter((e) => e.status === 'Active'), (e) => e.department)),
      },
    ],
    charts: [{ title: 'Payroll by Staff Type', type: 'pie', data: groupSum(payrolls, (p) => p.staff_type || 'permanent', (p) => p.netSalary) }],
  };
}

// ── 6. Attendance & Workforce ───────────────────────────────────────────────
export function aggregateAttendance(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const records = raw.attendance.filter((a) => inRange(a.date, range));
  const present = records.filter((a) => a.status === 'Present').length;
  const newHires = raw.employees.filter((e) => e.employmentStartDate && inRange(e.employmentStartDate, range));

  return {
    moduleId: 'attendance-workforce',
    moduleLabel: 'Attendance & Workforce',
    kpis: [
      kpi('Attendance Records', records.length, 'number'),
      kpi('Present Rate', records.length ? (present / records.length) * 100 : 0, 'percent'),
      kpi('Absences', records.filter((a) => a.status === 'Absent').length, 'number'),
      kpi('New Hires', newHires.length, 'number'),
      kpi('Active Workforce (current)', raw.employees.filter((e) => e.status === 'Active').length, 'number'),
    ],
    tables: [
      { title: 'By Status', columns: ['Status', 'Count'], rows: toRows(groupCount(records, (a) => a.status)) },
      { title: 'By Department (current)', columns: ['Department', 'Employees'], rows: toRows(groupCount(raw.employees, (e) => e.department)) },
    ],
    charts: [{ title: 'Attendance Status Split', type: 'pie', data: groupCount(records, (a) => a.status) }],
  };
}

// ── 7. Inventory & Stock ────────────────────────────────────────────────────
export function aggregateInventoryStock(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const logs = raw.stockLogs.filter((l) => inRange(l.date, range));
  const stockIn = logs.filter((l) => l.type === 'Stock In');
  const stockOut = logs.filter((l) => l.type === 'Stock Out');
  const stockInValue = sum(stockIn, (l) => Number(l.actual_unit_price || l.price) * Number(l.quantity));
  const stockOutValue = sum(stockOut, (l) => Number(l.actual_unit_price || l.price) * Number(l.quantity));
  const lowStock = raw.products.filter((p) => p.quantity < p.minStock);

  return {
    moduleId: 'inventory-stock',
    moduleLabel: 'Inventory & Stock',
    kpis: [
      kpi('Stock-In Value', stockInValue, 'currency'),
      kpi('Stock-Out Value', stockOutValue, 'currency'),
      kpi('Net Stock Movement', stockInValue - stockOutValue, 'currency'),
      kpi('Low-Stock Products (current)', lowStock.length, 'number'),
      kpi('Issuances in Period', raw.issuances.filter((i) => inRange(i.date, range)).length, 'number'),
    ],
    tables: [
      {
        title: 'Top Products by Stock-Out Value',
        columns: ['Product', 'Qty', 'Value (TZS)'],
        rows: groupSum(stockOut, (l) => l.productName, (l) => Number(l.actual_unit_price || l.price) * Number(l.quantity))
          .slice(0, 10)
          .map((g) => [g.name, sum(stockOut.filter((l) => l.productName === g.name), (l) => Number(l.quantity)), g.value]),
      },
      { title: 'Low-Stock Products', columns: ['Product', 'On Hand', 'Min Stock'], rows: lowStock.slice(0, 15).map((p) => [p.name, p.quantity, p.minStock]) },
    ],
    charts: [{ title: 'Stock In vs Out (Value)', type: 'pie', data: [{ name: 'Stock In', value: stockInValue }, { name: 'Stock Out', value: stockOutValue }] }],
  };
}

// ── 8. Menu & Costing ───────────────────────────────────────────────────────
export function aggregateMenuCosting(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const menus = raw.cateringMenus.filter((m) => inRange(m.created_at, range));
  const recipes = raw.recipes.filter((r) => inRange(r.createdAt, range));
  const avgPrice = menus.length ? sum(menus, (m) => m.price_per_person) / menus.length : 0;

  return {
    moduleId: 'menu-costing',
    moduleLabel: 'Menu & Costing',
    kpis: [
      kpi('New Menus Created', menus.length, 'number'),
      kpi('Avg. Price per Person', avgPrice, 'currency'),
      kpi('New Recipes Added', recipes.length, 'number'),
      kpi('Total Recipes (catalog)', raw.recipes.length, 'number'),
    ],
    tables: [
      { title: 'Menus Created in Period', columns: ['Menu', 'Type', 'Base People', 'Price/Person (TZS)'], rows: menus.slice(0, 15).map((m) => [m.name, m.menu_type_name || '—', m.base_people, m.price_per_person]) },
    ],
    charts: [{ title: 'Price per Person by Menu', type: 'bar', data: menus.slice(0, 8).map((m) => ({ name: m.name, value: m.price_per_person })) }],
  };
}

// ── 9. Assets & Equipment ───────────────────────────────────────────────────
export function aggregateAssetsEquipment(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const newAssets = raw.assets.filter((a) => inRange(a.createdAt, range));
  const totalValue = sum(raw.assets, (a) => a.unitPrice * a.quantity);
  const underMaintenance = raw.assets.filter((a) => a.status?.toLowerCase().includes('maintenance'));

  return {
    moduleId: 'assets-equipment',
    moduleLabel: 'Assets & Equipment',
    kpis: [
      kpi('Total Asset Value (current)', totalValue, 'currency'),
      kpi('Assets Under Maintenance', underMaintenance.length, 'number'),
      kpi('New Assets Acquired', newAssets.length, 'number'),
      kpi('Total Asset Count (current)', raw.assets.length, 'number'),
    ],
    tables: [
      { title: 'By Status (current)', columns: ['Status', 'Count'], rows: toRows(groupCount(raw.assets, (a) => a.status)) },
      { title: 'By Branch (current, value)', columns: ['Branch', 'Value (TZS)'], rows: toRows(groupSum(raw.assets, (a) => a.branch, (a) => a.unitPrice * a.quantity)) },
    ],
    charts: [{ title: 'Asset Value by Branch', type: 'pie', data: groupSum(raw.assets, (a) => a.branch, (a) => a.unitPrice * a.quantity) }],
  };
}

// ── 10. Delivery & Fulfillment ──────────────────────────────────────────────
export function aggregateDelivery(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const notes = raw.deliveryNotes.filter((n) => inRange(n.delivery_date, range));
  const prevNotes = raw.deliveryNotes.filter((n) => inPrevRange(n.delivery_date, range));
  const uniqueClients = new Set(notes.map((n) => n.client_id)).size;
  const avgItems = notes.length ? sum(notes, (n) => n.items.length) / notes.length : 0;

  return {
    moduleId: 'delivery-fulfillment',
    moduleLabel: 'Delivery & Fulfillment',
    kpis: [
      kpi('Deliveries Made', notes.length, 'number', prevNotes.length),
      kpi('Unique Clients Served', uniqueClients, 'number'),
      kpi('Avg. Items per Delivery', avgItems, 'number'),
    ],
    tables: [
      { title: 'By Location', columns: ['Location', 'Deliveries'], rows: toRows(groupCount(notes, (n) => n.delivery_location)).slice(0, 10) },
      { title: 'By Client', columns: ['Client', 'Deliveries'], rows: toRows(groupCount(notes, (n) => n.client_name)).slice(0, 10) },
    ],
    charts: [{ title: 'Deliveries by Location', type: 'bar', data: groupCount(notes, (n) => n.delivery_location).slice(0, 8) }],
  };
}

// ── 11. Clients ──────────────────────────────────────────────────────────────
export function aggregateClients(raw: RawDatasets, range: PeriodRange): ModuleReportData {
  const newClients = raw.clients.filter((c) => inRange(c.createdAt, range));
  const invoicesInRange = raw.invoices.filter((i) => inRange(i.invoiceDate, range));
  const revenueByClient = groupSum(invoicesInRange, (i) => raw.clients.find((c) => c.id === i.clientId)?.companyName || 'Walk-in / Direct', (i) => calcInvoiceTotals(i).grandTotal);
  const clientInvoiceCounts = new Map<string, number>();
  invoicesInRange.forEach((i) => { const k = i.clientId || 'walk-in'; clientInvoiceCounts.set(k, (clientInvoiceCounts.get(k) || 0) + 1); });
  const repeatClients = Array.from(clientInvoiceCounts.values()).filter((n) => n > 1).length;

  return {
    moduleId: 'clients',
    moduleLabel: 'Clients',
    kpis: [
      kpi('New Clients', newClients.length, 'number'),
      kpi('Total Clients (current)', raw.clients.length, 'number'),
      kpi('Repeat Clients (period)', repeatClients, 'number'),
      kpi('Clients Invoiced (period)', clientInvoiceCounts.size, 'number'),
    ],
    tables: [
      { title: 'Top Clients by Revenue', columns: ['Client', 'Revenue (TZS)'], rows: revenueByClient.slice(0, 10).map((g) => [g.name, g.value]) },
      { title: 'By Organization Type (current)', columns: ['Type', 'Count'], rows: toRows(groupCount(raw.clients, (c) => c.typeOfOrganization)) },
    ],
    charts: [{ title: 'Clients by Organization Type', type: 'pie', data: groupCount(raw.clients, (c) => c.typeOfOrganization) }],
  };
}
