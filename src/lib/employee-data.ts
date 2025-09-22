
"use client";

import type { Employee } from "@/types";
import type { EmployeeFormData } from "@/lib/schemas";

const EMPLOYEES_STORAGE_KEY = "caterSmartEmployees";

function getEmployeesFromStorage(): Employee[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveEmployeesToStorage(employees: Employee[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
}

export function getAllEmployees(): Employee[] {
  return getEmployeesFromStorage();
}

export function getEmployeeById(id: string): Employee | undefined {
  return getEmployeesFromStorage().find(emp => emp.id === id);
}

export function addEmployee(data: EmployeeFormData): Employee {
  const employees = getEmployeesFromStorage();
  const now = new Date().toISOString();

  if (employees.some(emp => emp.id === data.id)) {
    throw new Error(`Employee ID "${data.id}" already exists.`);
  }

  const newEmployee: Employee = {
    ...data,
    id: `EMP-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };

  saveEmployeesToStorage([...employees, newEmployee]);
  return newEmployee;
}

export function updateEmployee(id: string, updates: EmployeeFormData): Employee | undefined {
  const employees = getEmployeesFromStorage();
  const index = employees.findIndex(emp => emp.id === id);
  if (index === -1) return undefined;

  const updatedEmployee: Employee = {
    ...employees[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  employees[index] = updatedEmployee;
  saveEmployeesToStorage(employees);
  return updatedEmployee;
}

export function deleteEmployee(id: string): boolean {
  let employees = getEmployeesFromStorage();
  const initialLength = employees.length;
  employees = employees.filter(emp => emp.id !== id);

  if (employees.length < initialLength) {
    saveEmployeesToStorage(employees);
    return true;
  }
  return false;
}

    