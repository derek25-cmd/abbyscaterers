
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Client } from '@/types';
import type { ClientFormData } from '@/lib/schemas'; 
import { 
  getClients as getFromStorage,
  getClientById as getByIdFromStorage,
  addClient as addToStorage,
  updateClient as updateInStorage,
  deleteClient as deleteFromStorage 
} from '@/services/clientService';

export function useClientStorage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshClients = useCallback(async () => {
    setIsLoading(true);
    const data = await getFromStorage();
    setClients(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshClients();
  }, [refreshClients]);

  const addClient = useCallback(async (clientData: ClientFormData) => {
    const newClient = await addToStorage(clientData);
    if(newClient) {
      refreshClients();
    }
    return newClient;
  }, [refreshClients]);

  const updateClient = useCallback(async (id: string, updates: ClientFormData) => {
    const success = await updateInStorage(id, updates);
    if (success) {
      refreshClients();
    }
    return success;
  }, [refreshClients]);

  const deleteClient = useCallback(async (id: string) => {
    const success = await deleteFromStorage(id);
    if (success) {
      refreshClients();
    }
    return success;
  }, [refreshClients]);
  
  const getClientById = useCallback((id: string) => {
    return clients.find(c => c.id === id);
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
