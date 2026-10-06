import { ProformaListTable } from '@/components/proforma/proforma-list-table';

export default function ProformasPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Proformas</h1>
        <p className="text-sm text-muted-foreground">All proformas, most recent first.</p>
      </div>
      <ProformaListTable />
    </div>
  );
}
