
"use client";

import { ClientForm } from '@/components/clients/client-form';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Client } from '@/types';
import { Button } from '@/components/ui/button';
import Link from "next/link";
import { LoadingPage } from '@/components/layout/loading-page';

export function ClientEditPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getClientById, isLoading: storageLoading } = useClientStorage();
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [componentLoading, setComponentLoading] = useState(true); // Renamed from isLoading
  const [error, setError] = useState<string | null>(null);

  const clientId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (!clientId) {
      setError("Invalid client ID provided.");
      setClient(undefined);
      setComponentLoading(false);
      return;
    }

    if (storageLoading) {
      setComponentLoading(true);
      return;
    }
    
    setComponentLoading(true);
    setError(null);

    try {
      const fetchedClient = getClientById(clientId);
      if (fetchedClient) {
        setClient(fetchedClient);
      } else {
        setClient(undefined);
        setError("Client not found. Cannot edit a non-existent client.");
      }
    } catch (e: unknown) {
      console.error("Error fetching client for edit:", e);
      setClient(undefined);
      let message = "An unexpected error occurred while loading client data for editing.";
      if (e instanceof Error) {
        message = `An unexpected error occurred: ${e.message}`;
      }
      setError(message);
    } finally {
      setComponentLoading(false);
    }
  }, [clientId, getClientById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return <LoadingPage title="Loading Client Editor..." message="Getting everything ready for you to make changes."/>
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Client for Editing</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/clients">Go to Client List</Link>
        </Button>
      </div>
    );
  }

  if (!client || !client.id) { // Added check for client.id
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">Client Data Not Available for Editing</h2>
        <p className="text-muted-foreground mb-6">Could not load client data for editing. The client might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/clients">Go to Client List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <ClientForm client={client} />
    </div>
  );
}
