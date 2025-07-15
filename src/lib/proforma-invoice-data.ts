
"use client";

import type { ProformaInvoice } from "@/types";
import type { ProformaInvoiceFormData } from "@/lib/schemas";

const PROFORMA_INVOICES_STORAGE_KEY = "caterSmartProformaInvoices";

function getProformaInvoicesFromStorage(): ProformaInvoice[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(PROFORMA_INVOICES_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading proforma invoices from localStorage:", error);
    return [];
  }

  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing proforma invoices from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveProformaInvoicesToStorage(invoices: ProformaInvoice[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFORMA_INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  } catch (error) {
    console.error("Error saving proforma invoices to localStorage:", error);
  }
}

export function getAllProformaInvoices(): ProformaInvoice[] {
  return getProformaInvoicesFromStorage();
}

export function getProformaInvoiceById(id: string): ProformaInvoice | undefined {
  const allInvoices = getProformaInvoicesFromStorage();
  return allInvoices.find(invoice => invoice.id === id);
}

export function addProformaInvoice(invoiceData: ProformaInvoiceFormData): ProformaInvoice {
  const allInvoices = getProformaInvoicesFromStorage();
  const now = new Date().toISOString();

  if (allInvoices.some(inv => inv.id === invoiceData.id)) {
    throw new Error(`Proforma Invoice No. "${invoiceData.id}" already exists.`);
  }

  const newInvoice: ProformaInvoice = {
    ...invoiceData,
    createdAt: now,
    updatedAt: now,
  };
  const updatedList = [...allInvoices, newInvoice];
  saveProformaInvoicesToStorage(updatedList);
  return newInvoice;
}

export function updateProformaInvoice(originalId: string, updates: ProformaInvoiceFormData): ProformaInvoice | undefined {
  const allInvoices = getProformaInvoicesFromStorage();
  const invoiceIndex = allInvoices.findIndex(inv => inv.id === originalId);
  if (invoiceIndex === -1) return undefined;

  if (updates.id && updates.id !== originalId && allInvoices.some(inv => inv.id === updates.id)) {
    throw new Error(`Cannot update Proforma Invoice No. to "${updates.id}" as it already exists.`);
  }
  
  const updatedInvoice: ProformaInvoice = {
    ...allInvoices[invoiceIndex],
    ...updates,
    id: updates.id,
    updatedAt: new Date().toISOString(),
  };
  
  const updatedList = [...allInvoices];
  updatedList[invoiceIndex] = updatedInvoice;
  saveProformaInvoicesToStorage(updatedList);
  return updatedInvoice;
}

export function deleteProformaInvoice(id: string): boolean {
  let allInvoices = getProformaInvoicesFromStorage();
  const initialLength = allInvoices.length;
  allInvoices = allInvoices.filter(inv => inv.id !== id);
  if (allInvoices.length < initialLength) {
    saveProformaInvoicesToStorage(allInvoices);
    return true;
  }
  return false;
}
