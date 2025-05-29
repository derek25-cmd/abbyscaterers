
// No "use client" at the top of this file

import { EquipmentEditPageComponent } from './equipment-edit-page-component';

export async function generateStaticParams() {
  return [];
}

// This is now a Server Component
export default function EditEquipmentPage() {
  return <EquipmentEditPageComponent />;
}
