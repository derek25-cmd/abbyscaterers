
"use client";

import { ClientDetailsView } from '@/components/clients/client-details-view';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Client } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from "next/link";

export function ClientDetailsPageComponent() {
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
    if (!isMounted || !clientId) {
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
          setError("Client not found. The client may have been deleted or the ID is incorrect.");
        }
      } catch (e) {
        console.error("Error fetching client details:", e);
        setError("An unexpected error occurred while loading client data.");
      } finally {
        setIsLoading(false);
      }
    }
  }, [clientId, getClientById, storageLoading, isMounted]);

  if (!isMounted || isLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full md:col-span-2" />
          <Skeleton className="h-48 w-full md:col-span-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Client</h2>
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
        <h2 className="text-2xl font-semibold text-destructive mb-4">Client Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested client could not be found. It might have been deleted.</p>
        <Button asChild>
          <Link href="/clients">Go to Client List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ClientDetailsView client={client} />
    </div>
  );
}
