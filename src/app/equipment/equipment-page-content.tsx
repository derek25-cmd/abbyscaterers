
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const EquipmentListTable = dynamic(() =>
  import('@/components/equipment/equipment-list-table').then(mod => mod.EquipmentListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Inventory..." message="Cataloging your equipment and utensils." />
  }
);

export function EquipmentPageContent() {
  return <EquipmentListTable />;
}
