
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
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useClientStorage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
    try {
      const newClient = await addToStorage(clientData);
      if (newClient) refreshClients();
      return newClient;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save client', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshClients, toast]);

  const updateClient = useCallback(async (id: string, updates: ClientFormData) => {
    try {
      const success = await updateInStorage(id, updates);
      if (success) refreshClients();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update client', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshClients, toast]);

  const deleteClient = useCallback(async (id: string) => {
    try {
      const success = await deleteFromStorage(id);
      if (success) refreshClients();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete client', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshClients, toast]);

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
