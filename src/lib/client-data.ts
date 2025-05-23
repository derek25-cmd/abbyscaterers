
"use client"; // Ensure this module is treated as client-side

import type { Client } from "@/types";
import type { ClientFormData } from "@/lib/schemas";

const CLIENTS_STORAGE_KEY = "caterSmartClients";

function getClientsFromStorage(): Client[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(CLIENTS_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveClientsToStorage(clients: Client[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
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
    // Handle ID collision for new clients.
    // This ideally should be a validation error shown in the form.
    // For now, we'll throw an error which the form's submit handler can catch.
    throw new Error(`Client ID "${clientData.id}" already exists.`);
  }

  const newClient: Client = {
    id: clientData.id, // ID from form data
    companyName: clientData.companyName,
    companyEmail: clientData.companyEmail,
    phoneNumber: clientData.phoneNumber,
    address1: clientData.address1,
    address2: clientData.address2 || "", // Ensure address2 is string or empty string
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
  let clients = getClientsFromStorage();
  const clientIndex = clients.findIndex(client => client.id === originalId);
  if (clientIndex === -1) return undefined;

  // If the ID is being changed, check for collision with other existing clients
  if (updates.id && updates.id !== originalId && clients.some(c => c.id === updates.id)) {
    // ID collision with another existing client
    throw new Error(`Cannot update Client ID to "${updates.id}" as it already exists for another client.`);
  }
  
  const updatedClient: Client = {
    ...clients[clientIndex], // old data
    ...updates,             // new data from form, including potentially a new ID
    id: updates.id,         // Use new ID from form
    updatedAt: new Date().toISOString(),
  };
  clients[clientIndex] = updatedClient;
  saveClientsToStorage(clients);
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
