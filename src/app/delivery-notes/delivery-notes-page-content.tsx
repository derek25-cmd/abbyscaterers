
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const DeliveryNoteListTable = dynamic(() =>
  import('@/components/delivery-notes/delivery-note-list-table').then(mod => mod.DeliveryNoteListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Delivery Notes..." message="Organizing all your deliveries." />
  }
);

export function DeliveryNotesPageContent() {
  return <DeliveryNoteListTable />;
}

    