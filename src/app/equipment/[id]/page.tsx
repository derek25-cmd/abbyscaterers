
import { EquipmentDetailsPageComponent } from './equipment-details-page-component';

export const dynamic = 'error'; // Explicitly error for ungenerated dynamic segments
export const dynamicParams = false;

export async function generateStaticParams() {
  // For 'output: export', dynamic routes are handled client-side.
  // Returning an empty array indicates no paths are pre-rendered at build time.
  // Client-side navigation will still work if data exists.
  return [];
}

export default function EquipmentDetailPage({ params }: { params: { id: string } }) {
  return <EquipmentDetailsPageComponent />;
}
