
"use client"; // Ensure this module is treated as client-side

import type { Client } from "@/types";
import type { ClientFormData } from "@/lib/schemas";

const CLIENTS_STORAGE_KEY = "caterSmartClients";

function getClientsFromStorage(): Client[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(CLIENTS_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading clients from localStorage:", error);
    return []; // Return empty array on read error
  }

  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing clients from localStorage:", error);
      return []; // Return empty array on parsing error
    }
  }
  return [];
}

function saveClientsToStorage(clients: Client[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  } catch (error) {
    console.error("Error saving clients to localStorage:", error);
  }
}

export function getAllClients(): Client[] {
  return getClientsFromStorage();
}

export function getClientById(id: string): Client | undefined {
  const clients = getClientsFromStorage();
  return clients.find(client => client.id === id);
}

export function addClient(clientData: ClientFormData): Client {
  const clients = getClientsFromStorage();
  const now = new Date().toISOString();

  if (clients.some(c => c.id === clientData.id)) {
    throw new Error(`Client ID "${clientData.id}" already exists.`);
  }

  const newClient: Client = {
    id: clientData.id,
    companyName: clientData.companyName,
    companyEmail: clientData.companyEmail,
    phoneNumber: clientData.phoneNumber,
    address1: clientData.address1,
    address2: clientData.address2 || "",
    primaryLocation: clientData.primaryLocation,
    lastContacted: clientData.lastContacted,
    createdAt: now,
    updatedAt: now,
  };
  const updatedClients = [...clients, newClient];
  saveClientsToStorage(updatedClients);
  return newClient;
}

export function updateClient(originalId: string, updates: ClientFormData): Client | undefined {
  const clients = getClientsFromStorage();
  const clientIndex = clients.findIndex(client => client.id === originalId);
  if (clientIndex === -1) return undefined;

  if (updates.id && updates.id !== originalId && clients.some(c => c.id === updates.id)) {
    throw new Error(`Cannot update Client ID to "${updates.id}" as it already exists for another client.`);
  }
  
  const updatedClient: Client = {
    ...clients[clientIndex],
    ...updates,
    id: updates.id, // Ensure the ID is updated from the form data
    updatedAt: new Date().toISOString(),
  };
  
  const updatedClients = [...clients];
  updatedClients[clientIndex] = updatedClient;
  saveClientsToStorage(updatedClients);
  return updatedClient;
}

export function deleteClient(id: string): boolean {
  let clients = getClientsFromStorage();
  const initialLength = clients.length;
  clients = clients.filter(client => client.id !== id);
  if (clients.length < initialLength) {
    saveClientsToStorage(clients);
    return true;
  }
  return false;
}
