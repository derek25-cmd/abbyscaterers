
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Invoice } from "@/types";
import type { FinalInvoiceFormData } from "@/lib/schemas";
import {
  getInvoices as getAllFromStorage,
  getInvoiceById as getByIdFromStorage,
  addInvoice as addToStorage,
  updateInvoice as updateInStorage,
  deleteInvoice as deleteFromStorage,
  getLatestInvoiceNumber
} from '@/services/invoiceService';
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useInvoiceStorage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refreshInvoices = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllFromStorage();
    setInvoices(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshInvoices();
  }, [refreshInvoices]);

  const addInvoice = useCallback(async (data: FinalInvoiceFormData) => {
    try {
      const newItem = await addToStorage(data);
      if (newItem) refreshInvoices();
      return newItem;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save invoice', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshInvoices, toast]);

  const updateInvoice = useCallback(async (originalId: string, updates: Partial<FinalInvoiceFormData>) => {
    try {
      const result = await updateInStorage(originalId, updates);
      if (result) refreshInvoices();
      return result;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update invoice', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshInvoices, toast]);

  const deleteInvoice = useCallback(async (id: string) => {
    try {
      const success = await deleteFromStorage(id);
      if (success) refreshInvoices();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete invoice', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshInvoices, toast]);

  const getInvoiceById = useCallback((id: string) => {
    return invoices.find(i => i.id === id);
  }, [invoices]);

  const getInvoiceByProformaId = useCallback((proformaId: string) => {
    return invoices.find(invoice => invoice.proformaId === proformaId);
  }, [invoices]);

  const getNextInvoiceId = useCallback(async () => {
    const num = await getLatestInvoiceNumber();
    return String(num).padStart(7, '0');
  }, []);

  return {
    invoices,
    isLoading,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceById,
    getInvoiceByProformaId,
    refreshInvoices,
    getNextInvoiceId
  };
}
