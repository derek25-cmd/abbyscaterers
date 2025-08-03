
"use client";

import { EmployeeForm } from '@/components/hr/employee-form';
import { useEmployeeStorage } from '@/hooks/use-employee-storage';
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Employee } from '@/types';
import { LoadingPage } from '@/components/layout/loading-page';

export default function EditEmployeePage() {
  const params = useParams();
  const employeeId = typeof params.id === 'string' ? params.id : undefined;

  const { getEmployeeById, isLoading: storageLoading } = useEmployeeStorage();
  const [employee, setEmployee] = useState<Employee | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employeeId && !storageLoading) {
      try {
        const fetchedEmployee = getEmployeeById(employeeId);
        if (fetchedEmployee) {
          setEmployee(fetchedEmployee);
        } else {
          setError("Employee not found.");
        }
      } catch (e) {
        setError("Failed to fetch employee data.");
      }
    }
  }, [employeeId, getEmployeeById, storageLoading]);

  if (storageLoading) {
    return <LoadingPage title="Loading Employee Data..." />;
  }

  if (error) {
    return <div className="text-center text-destructive">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
       <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6">
         Edit Employee: {employee?.fullName}
        </h1>
      <EmployeeForm employee={employee} />
    </div>
  );
}
