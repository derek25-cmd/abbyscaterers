// @ts-nocheck
import { getAllOrders as getAllOrdersFromStorage } from '@/lib/daily-menu-data';

// This function provides a unified way to access order data, consistent with other services.
export const getOrders = async () => {
    if (typeof window === 'undefined') return [];
    // The underlying data-access function is synchronous, but we wrap in a promise
    // to maintain a consistent async interface across all services.
    return Promise.resolve(getAllOrdersFromStorage());
};

// You can add more functions here as needed, like getOrderById, addOrder, etc.
// by importing them from '@/lib/daily-menu-data' and re-exporting.
