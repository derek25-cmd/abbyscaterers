import { RfqDetail } from '@/components/rfq/rfq-detail';

export default function RfqDetailPage({ params }: { params: { id: string } }) {
  return <RfqDetail rfqId={params.id} />;
}
