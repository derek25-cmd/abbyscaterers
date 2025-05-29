
"use client";

import { ClientForm } from "@/components/clients/client-form";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Client } from "@/types";
import { Skeleton } from "@/components/ui/skeleton"; 
import { getAllClients } from "@/lib/client-data"; // Added for generateStaticParams

export async function generateStaticParams() {
  if (typeof window === 'undefined') {
    // During build time, window is not available.
    // If client-data relies on localStorage directly, it might return empty or throw.
    // Returning an empty array means no paths are pre-rendered.
    // Client-side navigation will still work if data exists when app runs.
    try {
        const clients = getAllClients();
        return clients.map((client) => ({
            id: client.id,
        }));
    } catch (e) {
        // In case getAllClients throws if localStorage is not available
        return [];
    }
  }
  const clients = getAllClients();
  return clients.map((client) => ({
    id: client.id,
  }));
}


export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const { getClientById, isLoading: storageLoading } = useClientStorage();
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    if (clientId) {
      if (!storageLoading) { 
        const fetchedClient = getClientById(clientId);
        if (fetchedClient) {
          setClient(fetchedClient);
        } else {
          setError("Client not found.");
        }
        setIsLoading(false);
      }
    } else {
      setError("Invalid client ID.");
      setIsLoading(false);
    }
  }, [clientId, getClientById, storageLoading, router]);

  if (isLoading || storageLoading) {
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
    return <div className="text-destructive text-center py-10">{error}</div>;
  }

  if (!client) {
    return <div className="text-center py-10">Client data could not be loaded.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ClientForm client={client} />
    </div>
  );
}
