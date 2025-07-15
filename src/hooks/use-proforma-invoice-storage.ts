
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ProformaInvoice } from "@/types";
import type { ProformaInvoiceFormData } from "@/lib/schemas";
import { 
  getAllProformaInvoices as getAllFromStorage,
  getProformaInvoiceById as getByIdFromStorage,
  addProformaInvoice as addToStorage,
  updateProformaInvoice as updateInStorage,
  deleteProformaInvoice as deleteFromStorage 
} from '@/lib/proforma-invoice-data';

export function useProformaInvoiceStorage() {
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProformaInvoices = useCallback(() => {
    if (typeof window !== "undefined") {
      setProformaInvoices(getAllFromStorage());
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setProformaInvoices(getAllFromStorage());
      setIsLoading(false);
    }
  }, []);

  const addProformaInvoice = useCallback((data: ProformaInvoiceFormData) => {
    const newItem = addToStorage(data);
    setProformaInvoices(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const updateProformaInvoice = useCallback((originalId: string, updates: ProformaInvoiceFormData) => {
    const updatedItem = updateInStorage(originalId, updates);
    if (updatedItem) {
      setProformaInvoices(prev => prev.map(item => item.id === originalId ? updatedItem : item));
      if (originalId !== updatedItem.id) {
        refreshProformaInvoices();
      }
    }
    return updatedItem;
  }, [refreshProformaInvoices]);

  const deleteProformaInvoice = useCallback((id: string) => {
    const success = deleteFromStorage(id);
    if (success) {
      setProformaInvoices(prev => prev.filter(item => item.id !== id));
    }
    return success;
  }, []);
  
  const getProformaById = useCallback((id: string) => {
    return getByIdFromStorage(id);
  }, []);

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
