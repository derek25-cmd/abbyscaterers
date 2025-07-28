

"use client";

import type { Invoice } from "@/types";
import type { FinalInvoiceFormData } from "@/lib/schemas";
import { updateProformaInvoice } from "./proforma-invoice-data";

const INVOICES_STORAGE_KEY = "caterSmartFinalInvoices";

function getInvoicesFromStorage(): Invoice[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(INVOICES_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading invoices from localStorage:", error);
    return [];
  }

  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing invoices from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveInvoicesToStorage(invoices: Invoice[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  } catch (error) {
    console.error("Error saving invoices to localStorage:", error);
  }
}

function markProformaAsInvoiced(proformaId: string) {
    const PROFORMA_KEY = "caterSmartProformaInvoices";
    if (typeof window === "undefined") return;

    try {
        const proformasData = localStorage.getItem(PROFORMA_KEY);
        if (proformasData) {
            let proformas = JSON.parse(proformasData);
            const proformaIndex = proformas.findIndex((p: any) => p.id === proformaId);
            if (proformaIndex !== -1) {
                proformas[proformaIndex].isInvoiced = true;
                localStorage.setItem(PROFORMA_KEY, JSON.stringify(proformas));
            }
        }
    } catch (error) {
        console.error("Failed to mark proforma as invoiced:", error);
    }
}

export function getAllInvoices(): Invoice[] {
  return getInvoicesFromStorage();
}

export function getInvoiceById(id: string): Invoice | undefined {
  const allInvoices = getInvoicesFromStorage();
  return allInvoices.find(invoice => invoice.id === id);
}

export function addInvoice(invoiceData: FinalInvoiceFormData): Invoice {
  const allInvoices = getInvoicesFromStorage();
  const now = new Date().toISOString();

  if (allInvoices.some(inv => inv.id === invoiceData.id)) {
    throw new Error(`Invoice No. "${invoiceData.id}" already exists.`);
  }

  const newInvoice: Invoice = {
    ...invoiceData,
    createdAt: now,
    updatedAt: now,
  };
  const updatedList = [...allInvoices, newInvoice];
  saveInvoicesToStorage(updatedList);
  
  // If this invoice was created from a proforma, mark it as invoiced.
  if (invoiceData.proformaId) {
      markProformaAsInvoiced(invoiceData.proformaId);
  }

  return newInvoice;
}

export function updateInvoice(originalId: string, updates: FinalInvoiceFormData): Invoice | undefined {
  const allInvoices = getInvoicesFromStorage();
  const invoiceIndex = allInvoices.findIndex(inv => inv.id === originalId);
  if (invoiceIndex === -1) return undefined;

  if (updates.id && updates.id !== originalId && allInvoices.some(inv => inv.id === updates.id)) {
    throw new Error(`Cannot update Invoice No. to "${updates.id}" as it already exists.`);
  }
  
  const updatedInvoice: Invoice = {
    ...allInvoices[invoiceIndex],
    ...updates,
    id: updates.id,
    updatedAt: new Date().toISOString(),
  };
  
  const updatedList = [...allInvoices];
  updatedList[invoiceIndex] = updatedInvoice;
  saveInvoicesToStorage(updatedList);
  return updatedInvoice;
}

export function deleteInvoice(id: string): boolean {
  let allInvoices = getInvoicesFromStorage();
  const initialLength = allInvoices.length;
  allInvoices = allInvoices.filter(inv => inv.id !== id);
  if (allInvoices.length < initialLength) {
    saveInvoicesToStorage(allInvoices);
    return true;
  }
  return false;
}
