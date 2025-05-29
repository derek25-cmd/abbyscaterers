
// No "use client" at the top of this file

import { EquipmentDetailsPageComponent } from './equipment-details-page-component';

export async function generateStaticParams() {
 return [];
}

// This is now a Server Component
export default function EquipmentDetailPage() {
  return <EquipmentDetailsPageComponent />;
}
