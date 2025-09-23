
"use client";

import type { Employee } from "@/types";
import { DEPARTMENTS, EMPLOYMENT_TYPES } from "@/lib/schemas";


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

export function addEmployee(data: Partial<Employee>): Employee {
  const employees = getEmployeesFromStorage();
  const now = new Date().toISOString();

  const newEmployee: Employee = {
    id: `EMP-${Date.now()}`,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    role: data.role || '',
    department: data.department || DEPARTMENTS[0],
    status: data.status || 'Active',
    createdAt: now,
    updatedAt: now,
    ...data,
  };

  saveEmployeesToStorage([...employees, newEmployee]);
  return newEmployee;
}

export function updateEmployee(id: string, updates: Partial<Employee>): Employee | undefined {
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
