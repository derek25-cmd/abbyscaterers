
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const ClientListTable = dynamic(() =>
  import('@/components/clients/client-list-table').then(mod => mod.ClientListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Clients..." message="Hang tight while we fetch your client list."/>
  }
);

export function ClientsPageContent() {
  return <ClientListTable />;
}
