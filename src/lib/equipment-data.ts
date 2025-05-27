
"use client";

import type { Equipment } from "@/types";
import type { EquipmentFormData } from "@/lib/schemas";

const EQUIPMENT_STORAGE_KEY = "caterSmartEquipment";

function getEquipmentFromStorage(): Equipment[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveEquipmentToStorage(equipment: Equipment[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equipment));
}

export function getAllEquipment(): Equipment[] {
  return getEquipmentFromStorage();
}

export function getEquipmentById(id: string): Equipment | undefined {
  const allEquipment = getEquipmentFromStorage();
  // Match by equipmentNumber as that's the user-facing ID for routing and uniqueness
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
    id: equipmentData.equipmentNumber, // Use equipmentNumber as the internal ID for consistency
    quantity: Number(equipmentData.quantity), // Ensure quantity is a number
    createdAt: now,
    updatedAt: now,
  };
  const updatedEquipmentList = [...allEquipment, newEquipment];
  saveEquipmentToStorage(updatedEquipmentList);
  return newEquipment;
}

export function updateEquipment(originalEquipmentNumber: string, updates: EquipmentFormData): Equipment | undefined {
  let allEquipment = getEquipmentFromStorage();
  const equipmentIndex = allEquipment.findIndex(eq => eq.equipmentNumber === originalEquipmentNumber);
  if (equipmentIndex === -1) return undefined;

  // If the equipmentNumber is being changed, check for collision
  if (updates.equipmentNumber && updates.equipmentNumber !== originalEquipmentNumber && allEquipment.some(eq => eq.equipmentNumber === updates.equipmentNumber)) {
    throw new Error(`Cannot update Equipment No. to "${updates.equipmentNumber}" as it already exists for other equipment.`);
  }
  
  const updatedEquipment: Equipment = {
    ...allEquipment[equipmentIndex],
    ...updates,
    id: updates.equipmentNumber, // Update internal ID to match new equipmentNumber
    quantity: Number(updates.quantity), // Ensure quantity is a number
    updatedAt: new Date().toISOString(),
  };
  allEquipment[equipmentIndex] = updatedEquipment;
  saveEquipmentToStorage(allEquipment);
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
