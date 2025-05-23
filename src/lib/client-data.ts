
"use client"; // Ensure this module is treated as client-side

import type { Client } from "@/types";

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

export function addClient(client: Omit<Client, "id" | "createdAt" | "updatedAt">): Client {
  const clients = getClientsFromStorage();
  const now = new Date().toISOString();
  const newClient: Client = {
    ...client,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const updatedClients = [...clients, newClient];
  saveClientsToStorage(updatedClients);
  return newClient;
}

export function updateClient(id: string, updates: Partial<Omit<Client, "id" | "createdAt">>): Client | undefined {
  let clients = getClientsFromStorage();
  const clientIndex = clients.findIndex(client => client.id === id);
  if (clientIndex === -1) return undefined;

  const updatedClient = {
    ...clients[clientIndex],
    ...updates,
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
