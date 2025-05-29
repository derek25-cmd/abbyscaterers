
"use client";

import type { Equipment } from "@/types";
import type { EquipmentFormData } from "@/lib/schemas";

const EQUIPMENT_STORAGE_KEY = "caterSmartEquipment";

function getEquipmentFromStorage(): Equipment[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading equipment from localStorage:", error);
    return [];
  }

  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing equipment from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveEquipmentToStorage(equipment: Equipment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equipment));
  } catch (error) {
    console.error("Error saving equipment to localStorage:", error);
  }
}

export function getAllEquipment(): Equipment[] {
  return getEquipmentFromStorage();
}

export function getEquipmentById(id: string): Equipment | undefined {
  const allEquipment = getEquipmentFromStorage();
  return allEquipment.find(eq => eq.equipmentNumber === id);
}

export function addEquipment(equipmentData: EquipmentFormData): Equipment {
  const allEquipment = getEquipmentFromStorage();
  const now = new Date().toISOString();

  if (allEquipment.some(eq => eq.equipmentNumber === equipmentData.equipmentNumber)) {
    throw new Error(`Equipment No. "${equipmentData.equipmentNumber}" already exists.`);
  }

  const newEquipment: Equipment = {
    ...equipmentData,
    id: equipmentData.equipmentNumber, 
    quantity: Number(equipmentData.quantity),
    createdAt: now,
    updatedAt: now,
  };
  const updatedEquipmentList = [...allEquipment, newEquipment];
  saveEquipmentToStorage(updatedEquipmentList);
  return newEquipment;
}

export function updateEquipment(originalEquipmentNumber: string, updates: EquipmentFormData): Equipment | undefined {
  const allEquipment = getEquipmentFromStorage();
  const equipmentIndex = allEquipment.findIndex(eq => eq.equipmentNumber === originalEquipmentNumber);
  if (equipmentIndex === -1) return undefined;

  if (updates.equipmentNumber && updates.equipmentNumber !== originalEquipmentNumber && allEquipment.some(eq => eq.equipmentNumber === updates.equipmentNumber)) {
    throw new Error(`Cannot update Equipment No. to "${updates.equipmentNumber}" as it already exists for other equipment.`);
  }
  
  const updatedEquipment: Equipment = {
    ...allEquipment[equipmentIndex],
    ...updates,
    id: updates.equipmentNumber, // Ensure the id is updated if equipmentNumber changes
    equipmentNumber: updates.equipmentNumber,
    quantity: Number(updates.quantity),
    updatedAt: new Date().toISOString(),
  };
  
  const updatedAllEquipment = [...allEquipment];
  updatedAllEquipment[equipmentIndex] = updatedEquipment;
  saveEquipmentToStorage(updatedAllEquipment);
  return updatedEquipment;
}

export function deleteEquipment(equipmentNumber: string): boolean {
  let allEquipment = getEquipmentFromStorage();
  const initialLength = allEquipment.length;
  allEquipment = allEquipment.filter(eq => eq.equipmentNumber !== equipmentNumber);
  if (allEquipment.length < initialLength) {
    saveEquipmentToStorage(allEquipment);
    return true;
  }
  return false;
}
