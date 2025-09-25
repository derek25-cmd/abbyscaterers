
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ProformaInvoice } from "@/types";
import type { ProformaInvoiceFormData } from "@/lib/schemas";
import { 
  getProformaInvoices as getAllFromStorage,
  getProformaInvoiceById as getByIdFromStorage,
  addProformaInvoice as addToStorage,
  updateProformaInvoice as updateInStorage,
  deleteProformaInvoice as deleteFromStorage 
} from '@/services/proformaInvoiceService';

export function useProformaInvoiceStorage() {
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProformaInvoices = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllFromStorage();
    setProformaInvoices(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshProformaInvoices();
  }, [refreshProformaInvoices]);

  const addProformaInvoice = useCallback(async (data: ProformaInvoiceFormData) => {
    const newItem = await addToStorage(data);
    if(newItem) {
      refreshProformaInvoices();
    }
    return newItem;
  }, [refreshProformaInvoices]);

  const updateProformaInvoice = useCallback(async (originalId: string, updates: ProformaInvoiceFormData) => {
    const success = await updateInStorage(originalId, updates);
    if (success) {
      refreshProformaInvoices();
    }
    return success;
  }, [refreshProformaInvoices]);

  const deleteProformaInvoice = useCallback(async (id: string) => {
    const success = await deleteFromStorage(id);
    if (success) {
      refreshProformaInvoices();
    }
    return success;
  }, [refreshProformaInvoices]);
  
  const getProformaById = useCallback((id: string) => {
    return proformaInvoices.find(p => p.id === id);
  }, [proformaInvoices]);

  return { 
    proformaInvoices, 
    isLoading, 
    addProformaInvoice, 
    updateProformaInvoice, 
    deleteProformaInvoice, 
    getProformaById,
    refreshProformaInvoices 
  };
}
