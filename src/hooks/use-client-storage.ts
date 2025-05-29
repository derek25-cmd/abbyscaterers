
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Client } from '@/types';
import type { ClientFormData } from '@/lib/schemas'; // Import ClientFormData
import { 
  getAllClients as getAllClientsFromStorage,
  getClientById as getClientByIdFromStorage,
  addClient as addClientToStorage,
  updateClient as updateClientInStorage,
  deleteClient as deleteClientFromStorage 
} from '@/lib/client-data';

export function useClientStorage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial load from localStorage
    if (typeof window !== "undefined") {
      setClients(getAllClientsFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshClients = useCallback(() => {
    if (typeof window !== "undefined") {
      setClients(getAllClientsFromStorage());
    }
  }, []);

  const addClient = useCallback((clientData: ClientFormData) => { // Changed type here
    const newClient = addClientToStorage(clientData);
    setClients(prevClients => [...prevClients, newClient]);
    return newClient;
  }, []);

  const updateClient = useCallback((id: string, updates: ClientFormData) => { // Ensure updates is ClientFormData
    const updatedClient = updateClientInStorage(id, updates);
    if (updatedClient) {
      setClients(prevClients => 
        // If ID can change, we need to handle replacing the old ID with the new one
        // or simply refresh all clients to get the latest state.
        // For simplicity, if ID changed, the list might briefly show both old & new ID
        // until next full refresh, or we find by original ID for update, then filter by new ID.
        // The current updateClientInStorage handles ID changes.
        prevClients.map(c => c.id === (updatedClient.id === id ? id : updatedClient.id) ? updatedClient : c)
                   .filter((c, index, self) => index === self.findIndex(t => t.id === c.id)) // Ensure unique IDs
      );
    }
    return updatedClient;
  }, []);

  const deleteClient = useCallback((id: string) => {
    const success = deleteClientFromStorage(id);
    if (success) {
      setClients(prevClients => prevClients.filter(c => c.id !== id));
    }
    return success;
  }, []);
  
  const getClientById = useCallback((id: string) => {
     // Try to get from current state first for speed, then fallback to storage if needed
     // This is useful if the state isn't perfectly in sync or for direct calls
    const clientFromState = clients.find(c => c.id === id);
    if (clientFromState) return clientFromState;
    return getClientByIdFromStorage(id);
  }, [clients]);


  return { 
    clients, 
    isLoading, 
    addClient, 
    updateClient, 
    deleteClient, 
    getClientById,
    refreshClients 
  };
}

