const kpis = [
  { label: 'Pending RFQs', value: '—' },
  { label: 'Pending Proforma Approvals', value: '—' },
  { label: 'Outstanding Invoices', value: '—' },
  { label: 'Revenue this month', value: '—' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Placeholder KPIs — wired to real queries in a later phase.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-semibold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
