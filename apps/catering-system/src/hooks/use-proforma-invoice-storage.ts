
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
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useProformaInvoiceStorage() {
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
    try {
      const newItem = await addToStorage(data);
      if (newItem) refreshProformaInvoices();
      return newItem;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save proforma invoice', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshProformaInvoices, toast]);

  const updateProformaInvoice = useCallback(async (originalId: string, updates: Partial<ProformaInvoiceFormData>) => {
    try {
      const result = await updateInStorage(originalId, updates);
      if (result) refreshProformaInvoices();
      return result;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update proforma invoice', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshProformaInvoices, toast]);

  const deleteProformaInvoice = useCallback(async (id: string) => {
    try {
      const success = await deleteFromStorage(id);
      if (success) refreshProformaInvoices();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete proforma invoice', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshProformaInvoices, toast]);

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
