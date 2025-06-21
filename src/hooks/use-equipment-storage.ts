
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Equipment } from "@/types";
import type { EquipmentFormData } from "@/lib/schemas"; // Corrected import path
import { 
  getAllEquipment as getAllEquipmentFromStorage,
  getEquipmentById as getEquipmentByIdFromStorage,
  addEquipment as addEquipmentToStorage,
  updateEquipment as updateEquipmentInStorage,
  deleteEquipment as deleteEquipmentFromStorage,
  addMultipleEquipment as addMultipleEquipmentToStorage
} from '@/lib/equipment-data';

export function useEquipmentStorage() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEquipmentList(getAllEquipmentFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshEquipment = useCallback(() => {
    if (typeof window !== "undefined") {
      setEquipmentList(getAllEquipmentFromStorage());
    }
  }, []);

  const addEquipment = useCallback((equipmentData: EquipmentFormData) => { // Param type from schema
    const newEquipment = addEquipmentToStorage(equipmentData);
    setEquipmentList(prevEquipment => [...prevEquipment, newEquipment]);
    return newEquipment;
  }, []);

  const addBulkEquipment = useCallback((equipmentDataList: EquipmentFormData[]) => {
    const newItems = addMultipleEquipmentToStorage(equipmentDataList);
    setEquipmentList(prev => [...prev, ...newItems]);
    return newItems;
  }, []);

  const updateEquipment = useCallback((originalId: string, updates: EquipmentFormData) => { // Param type from schema
    const updatedItem = updateEquipmentInStorage(originalId, updates);
    if (updatedItem) {
      setEquipmentList(prevEquipment => 
        prevEquipment.map(eq => eq.equipmentNumber === originalId ? updatedItem : eq)
      );
    }
    return updatedItem;
  }, []);

  const deleteEquipment = useCallback((id: string) => {
    const success = deleteEquipmentFromStorage(id);
    if (success) {
      setEquipmentList(prevEquipment => prevEquipment.filter(eq => eq.equipmentNumber !== id));
    }
    return success;
  }, []);
  
  const getEquipmentById = useCallback((id: string) => {
    const itemFromState = equipmentList.find(eq => eq.equipmentNumber === id);
    if (itemFromState) return itemFromState;
    return getEquipmentByIdFromStorage(id);
  }, [equipmentList]);

  return { 
    equipmentList, 
    isLoading, 
    addEquipment, 
    updateEquipment, 
    deleteEquipment, 
    getEquipmentById,
    refreshEquipment,
    addBulkEquipment
  };
}
