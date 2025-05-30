
"use client";

import { ClientForm } from '@/components/clients/client-form';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Client } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from "next/link";

export function ClientEditPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getClientById, isLoading: storageLoading } = useClientStorage();
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if(!isMounted || !clientId) {
      if (!clientId && isMounted) {
          setError("Invalid client ID provided.");
          setIsLoading(false);
      }
      return;
    }

    if (!storageLoading) { 
      setIsLoading(true); // Set loading true before fetching
      try {
        const fetchedClient = getClientById(clientId);
        if (fetchedClient) {
          setClient(fetchedClient);
        } else {
          setError("Client not found.");
        }
      } catch (e: unknown) {
        console.error("Error fetching client for edit:", e);
        let message = "An unexpected error occurred while loading client data for editing.";
        if (e instanceof Error) {
          message = `An unexpected error occurred: ${e.message}`;
        }
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }
  }, [clientId, getClientById, storageLoading, isMounted]);

  if (!isMounted || isLoading || storageLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96 w-full" />
        <div className="flex justify-end gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
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

  if (!client) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">Client Data Not Available</h2>
        <p className="text-muted-foreground mb-6">Could not load client data for editing. The client might have been deleted.</p>
        <Button asChild>
          <Link href="/clients">Go to Client List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ClientForm client={client} />
    </div>
  );
}
