
"use client";

import { EmployeeForm } from "@/components/hr/employee-form";

export default function NewEmployeePage() {
  return (
    <div className="max-w-4xl mx-auto">
       <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6">
         Add New Employee
        </h1>
      <EmployeeForm />
    </div>
  );
}
