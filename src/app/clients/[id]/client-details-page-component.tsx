
"use client";

import { ClientDetailsView } from '@/components/clients/client-details-view';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Client } from '@/types';
import { Button } from '@/components/ui/button';
import Link from "next/link";
import { LoadingPage } from '@/components/layout/loading-page';
import { ClientActionCenter } from '@/components/clients/client-action-center';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";


export function ClientDetailsPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getClientById, isLoading: storageLoading } = useClientStorage();
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [componentLoading, setComponentLoading] = useState(true); // Renamed from isLoading to avoid conflict
  const [error, setError] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

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
      setComponentLoading(true); // Ensure loading state is true if storage is still loading
      return;
    }

    setComponentLoading(true); // Explicitly set loading before fetching
    setError(null); // Clear previous errors

    try {
      const fetchedClient = getClientById(clientId);
      if (fetchedClient) {
        setClient(fetchedClient);
      } else {
        setClient(undefined);
        setError("Client not found. The client may have been deleted or the ID is incorrect.");
      }
    } catch (e) {
      console.error("Error fetching client details:", e);
      setClient(undefined);
      setError("An unexpected error occurred while loading client data.");
    } finally {
      setComponentLoading(false);
    }
  }, [clientId, getClientById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return <LoadingPage title="Loading Client Details..." message="Fetching client records, just a moment." />;
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
  
  if (!client || !client.id) { // Added check for client.id for robustness
     return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Client Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested client could not be found. It might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/clients">Go to Client List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen} className="space-y-2">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-xl font-semibold text-foreground">
            Client Details
          </h2>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDetailsOpen ? '' : '-rotate-90'}`} />
              <span className="sr-only">Toggle Details</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="CollapsibleContent">
            <ClientDetailsView client={client} />
        </CollapsibleContent>
      </Collapsible>

      <ClientActionCenter client={client} />
    </div>
  );
}
