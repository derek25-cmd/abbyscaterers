
"use client";

import type { Order } from "@/types";
import type { OrderFormData } from "@/lib/schemas";

const ORDERS_STORAGE_KEY = "caterSmartOrders";

function getOrdersFromStorage(): Order[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(ORDERS_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading orders from localStorage:", error);
    return [];
  }

  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing orders from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveOrdersToStorage(orders: Order[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (error) {
    console.error("Error saving orders to localStorage:", error);
  }
}

export function getAllOrders(): Order[] {
  return getOrdersFromStorage();
}

export function getOrderById(id: string): Order | undefined {
  const allOrders = getOrdersFromStorage();
  return allOrders.find(order => order.id === id);
}

export function addOrder(orderData: OrderFormData): Order {
  const allOrders = getOrdersFromStorage();
  const now = new Date().toISOString();

  if (allOrders.some(order => order.id === orderData.id)) {
    throw new Error(`Order ID "${orderData.id}" already exists.`);
  }

  const newOrder: Order = {
    ...orderData,
    createdAt: now,
    updatedAt: now,
  };
  const updatedOrderList = [...allOrders, newOrder];
  saveOrdersToStorage(updatedOrderList);
  return newOrder;
}

export function updateOrder(originalId: string, updates: OrderFormData): Order | undefined {
  const allOrders = getOrdersFromStorage();
  const orderIndex = allOrders.findIndex(order => order.id === originalId);
  if (orderIndex === -1) return undefined;

  if (updates.id && updates.id !== originalId && allOrders.some(order => order.id === updates.id)) {
    throw new Error(`Cannot update Order ID to "${updates.id}" as it already exists for another order.`);
  }
  
  const updatedOrder: Order = {
    ...allOrders[orderIndex],
    ...updates,
    id: updates.id,
    updatedAt: new Date().toISOString(),
  };
  
  const updatedAllOrders = [...allOrders];
  updatedAllOrders[orderIndex] = updatedOrder;
  saveOrdersToStorage(updatedAllOrders);
  return updatedOrder;
}

export function deleteOrder(id: string): boolean {
  let allOrders = getOrdersFromStorage();
  const initialLength = allOrders.length;
  allOrders = allOrders.filter(order => order.id !== id);
  if (allOrders.length < initialLength) {
    saveOrdersToStorage(allOrders);
    return true;
  }
  return false;
}
