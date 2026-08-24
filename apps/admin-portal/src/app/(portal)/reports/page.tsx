'use client';

import Link from 'next/link';
import { DollarSign, Receipt, GitBranch, CalendarDays, FileText, Wallet, Clock, TrendingUp, Users } from 'lucide-react';
import { usePortalRole } from '@/lib/portal-role';

const REPORTS = [
  {
    section: 'Financial',
    items: [
      { href: '/reports/sales', label: 'Sales / Revenue Report', icon: DollarSign, desc: 'Invoiced revenue by period' },
      { href: '/reports/vat', label: 'VAT Report', icon: Receipt, desc: 'Output VAT from invoices, by period' },
      { href: '/reports/proforma-pipeline', label: 'Proforma Pipeline', icon: GitBranch, desc: 'Approval status and conversion rate' },
    ],
  },
  {
    section: 'Operational',
    items: [
      { href: '/reports/orders', label: 'Orders / Events Report', icon: CalendarDays, desc: 'Upcoming, completed, cancelled orders' },
      { href: '/reports/rfqs', label: 'RFQ Report', icon: FileText, desc: 'RFQs by status, branch, response time' },
    ],
  },
  {
    section: 'HR',
    roles: ['super_admin', 'finance'] as const,
    items: [
      { href: '/reports/payroll', label: 'Payroll Summary', icon: Wallet, desc: 'Gross/net salary by employee, period' },
      { href: '/reports/attendance', label: 'Attendance Report', icon: Clock, desc: 'Presence/absence by period' },
    ],
  },
  {
    section: 'Management',
    items: [
      { href: '/reports/revenue-trend', label: 'Revenue Trend', icon: TrendingUp, desc: 'Daily/weekly/monthly/YTD revenue' },
      { href: '/reports/customers', label: 'Customer Performance', icon: Users, desc: 'Top clients by revenue and frequency' },
    ],
  },
];

export default function ReportsPage() {
  const { role } = usePortalRole();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports Centre</h1>
        <p className="text-sm text-muted-foreground">Financial, operational, HR, and management reports.</p>
      </div>

      {REPORTS.filter((section) => !section.roles || (role && (section.roles as readonly string[]).includes(role))).map(
        (section) => (
          <div key={section.section}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-3">{section.section}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors flex items-start gap-3"
                >
                  <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
