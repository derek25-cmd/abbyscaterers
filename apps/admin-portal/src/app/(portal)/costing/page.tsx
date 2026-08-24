import { CostingListTable } from '@/components/costing/costing-list-table';

export default function CostingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Costing</h1>
        <p className="text-sm text-muted-foreground">
          Costing requests and their results, once fulfilled by the catering system team.
        </p>
      </div>
      <CostingListTable />
    </div>
  );
}
