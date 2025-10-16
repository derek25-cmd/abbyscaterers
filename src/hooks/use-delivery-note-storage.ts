
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { DeliveryNote } from "@/types";
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

  const addDeliveryNote = useCallback(async (orderId: string, details: { vehicleRegNo: string, deliveredBy: string }) => {
    const newDeliveryNote = await createDeliveryNoteInService(orderId, details);
    if(newDeliveryNote) {
      await refreshDeliveryNotes();
    }
    return newDeliveryNote;
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
