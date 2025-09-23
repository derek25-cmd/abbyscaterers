
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ProformaInvoice, Invoice } from "@/types";
import type { ProformaInvoiceFormData, FinalInvoiceFormData } from "@/lib/schemas";
import { 
  getAllProformaInvoices as getAllFromStorage,
  getProformaInvoiceById as getByIdFromStorage,
  addProformaInvoice as addToStorage,
  updateProformaInvoice as updateInStorage,
  deleteProformaInvoice as deleteFromStorage 
} from '@/lib/proforma-invoice-data';
import { useInvoiceStorage } from './use-invoice-storage';

export function useProformaInvoiceStorage() {
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getInvoiceByProformaId, updateInvoice } = useInvoiceStorage();


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

      // Cascade update to the final invoice if it exists
      if (updatedItem.isInvoiced) {
        const finalInvoice = getInvoiceByProformaId(originalId);
        if (finalInvoice) {
            const invoiceUpdates: FinalInvoiceFormData = {
                ...finalInvoice,
                // Map relevant fields from proforma to final invoice
                clientId: updatedItem.clientId,
                receiverName: updatedItem.receiverName,
                receiverPosition: updatedItem.receiverPosition,
                lpoNumber: updatedItem.lpoNumber,
                location: updatedItem.location,
                numberOfDays: updatedItem.numberOfDays,
                multiplyByDays: updatedItem.multiplyByDays,
                serviceCharge: updatedItem.serviceCharge,
                transportCosts: updatedItem.transportCosts,
                vatType: updatedItem.vatType,
                selectedEventType: updatedItem.selectedEventType,
                customEventType: updatedItem.customEventType,
                startDate: updatedItem.startDate,
                endDate: updatedItem.endDate,
                serviceFields: updatedItem.serviceFields,
                serviceDesc: updatedItem.serviceDesc,
                items: updatedItem.items,
                id: finalInvoice.id,
                status: finalInvoice.status,
                invoiceDate: finalInvoice.invoiceDate
            };
            updateInvoice(finalInvoice.id, invoiceUpdates);
        }
      }
    }
    return updatedItem;
  }, [refreshProformaInvoices, getInvoiceByProformaId, updateInvoice]);

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
