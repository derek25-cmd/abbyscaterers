
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { DeliveryNote, Order } from "@/types";
import {
  getDeliveryNotes as getDeliveryNotesFromService,
  createDeliveryNoteFromOrder as createDeliveryNoteInService,
  deleteDeliveryNote as deleteDeliveryNoteFromService,
} from '@/services/deliveryNoteService';
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useDeliveryNoteStorage() {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refreshDeliveryNotes = useCallback(async () => {
    setIsLoading(true);
    const data = await getDeliveryNotesFromService();
    setDeliveryNotes(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshDeliveryNotes();
  }, [refreshDeliveryNotes]);

  const addDeliveryNote = useCallback(async (order: Order, details: {
    vehicleRegNo?: string;
    deliveredBy: string;
    location: string;
    eventIndex: number;
    items: { qty: number; itemCode: string; description: string; }[];
    is_narration?: boolean;
    narration_text?: string;
  }) => {
    try {
      const newDeliveryNotes = await createDeliveryNoteInService(order, details);
      if (newDeliveryNotes && newDeliveryNotes.length > 0) await refreshDeliveryNotes();
      return newDeliveryNotes;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to create delivery note', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshDeliveryNotes, toast]);

  const deleteDeliveryNote = useCallback(async (id: string) => {
    try {
      const success = await deleteDeliveryNoteFromService(id);
      if (success) await refreshDeliveryNotes();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete delivery note', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshDeliveryNotes, toast]);

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
