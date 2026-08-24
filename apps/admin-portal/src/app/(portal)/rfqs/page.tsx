import { RfqListTable, NewRfqLink } from '@/components/rfq/rfq-list-table';

export default function RfqsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RFQs</h1>
        <NewRfqLink />
      </div>
      <RfqListTable />
    </div>
  );
}
