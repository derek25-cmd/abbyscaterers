
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Employee } from "@/types";
import { 
  getAllEmployees as getAllFromStorage,
  getEmployeeById as getByIdFromStorage,
  addEmployee as addToStorage,
  updateEmployee as updateInStorage,
  deleteEmployee as deleteFromStorage 
} from '@/lib/employee-data';
import { EmployeeFormData } from '@/lib/schemas';

export function useEmployeeStorage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEmployees(getAllFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshEmployees = useCallback(() => {
    if (typeof window !== "undefined") {
      setEmployees(getAllFromStorage());
    }
  }, []);

  const addEmployee = useCallback((data: EmployeeFormData) => {
    const newItem = addToStorage(data);
    setEmployees(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const updateEmployee = useCallback((employeeId: string, updates: Partial<Employee>) => {
    const updatedItem = updateInStorage(employeeId, updates);
    if (updatedItem) {
      setEmployees(prev => prev.map(item => item.id === employeeId ? updatedItem : item));
    }
    return updatedItem;
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    const success = deleteFromStorage(id);
    if (success) {
      setEmployees(prev => prev.filter(item => item.id !== id));
    }
    return success;
  }, []);
  
  const getEmployeeById = useCallback((id: string) => {
    return getByIdFromStorage(id);
  }, []);

  return { 
    employees, 
    isLoading, 
    addEmployee, 
    updateEmployee, 
    deleteEmployee, 
    getEmployeeById,
    refreshEmployees 
  };
}
