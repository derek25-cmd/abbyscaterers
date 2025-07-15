
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Invoice } from "@/types";
import type { InvoiceFormData } from "@/lib/schemas";
import { 
  getAllInvoices as getAllFromStorage,
  getInvoiceById as getByIdFromStorage,
  addInvoice as addToStorage,
  updateInvoice as updateInStorage,
  deleteInvoice as deleteFromStorage 
} from '@/lib/invoice-data';

export function useInvoiceStorage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshInvoices = useCallback(() => {
    if (typeof window !== "undefined") {
      setInvoices(getAllFromStorage());
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInvoices(getAllFromStorage());
      setIsLoading(false);
    }
  }, []);

  const addInvoice = useCallback((data: InvoiceFormData) => {
    const newItem = addToStorage(data);
    setInvoices(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const updateInvoice = useCallback((originalId: string, updates: InvoiceFormData) => {
    const updatedItem = updateInStorage(originalId, updates);
    if (updatedItem) {
      setInvoices(prev => prev.map(item => item.id === originalId ? updatedItem : item));
      if (originalId !== updatedItem.id) {
        refreshInvoices();
      }
    }
    return updatedItem;
  }, [refreshInvoices]);

  const deleteInvoice = useCallback((id: string) => {
    const success = deleteFromStorage(id);
    if (success) {
      setInvoices(prev => prev.filter(item => item.id !== id));
    }
    return success;
  }, []);
  
  const getInvoiceById = useCallback((id: string) => {
    return getByIdFromStorage(id);
  }, []);

  return { 
    invoices, 
    isLoading, 
    addInvoice, 
    updateInvoice, 
    deleteInvoice, 
    getInvoiceById,
    refreshInvoices 
  };
}
