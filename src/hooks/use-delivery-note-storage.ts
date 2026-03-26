
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { DeliveryNote, Order } from "@/types";
import {
  getDeliveryNotes as getDeliveryNotesFromService,
  createDeliveryNoteFromOrder as createDeliveryNoteInService,
  deleteDeliveryNote as deleteDeliveryNoteFromService,
} from '@/services/deliveryNoteService';

export function useDeliveryNoteStorage() {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDeliveryNotes = useCallback(async () => {
    setIsLoading(true);
    const data = await getDeliveryNotesFromService();
    setDeliveryNotes(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshDeliveryNotes();
  }, [refreshDeliveryNotes]);

  const addDeliveryNote = useCallback(async (order: Order, details: { vehicleRegNo?: string; deliveredBy: string; location: string; }) => {
    const newDeliveryNotes = await createDeliveryNoteInService(order, details);
    if(newDeliveryNotes && newDeliveryNotes.length > 0) {
      await refreshDeliveryNotes();
    }
    return newDeliveryNotes;
  }, [refreshDeliveryNotes]);

  const deleteDeliveryNote = useCallback(async (id: string) => {
    const success = await deleteDeliveryNoteFromService(id);
    if (success) {
      await refreshDeliveryNotes();
    }
    return success;
  }, [refreshDeliveryNotes]);
  
  const getDeliveryNoteById = useCallback((id: string) => {
    return deliveryNotes.find(dn => dn.id === id);
  }, [deliveryNotes]);

  return { 
    deliveryNotes,
    isLoading, 
    addDeliveryNote,
    deleteDeliveryNote, 
    getDeliveryNoteById,
    refreshDeliveryNotes 
  };
}
