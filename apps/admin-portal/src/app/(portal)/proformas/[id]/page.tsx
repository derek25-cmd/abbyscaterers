import { ProformaView } from '@/components/proforma/proforma-view';

export default function ProformaViewPage({ params }: { params: { id: string } }) {
  return <ProformaView proformaId={params.id} />;
}
