
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const EmployeeListTable = dynamic(() =>
  import('@/components/hr/employee-list-table').then(mod => mod.EmployeeListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Employees..." message="Fetching your employee directory." />
  }
);

export default function HumanResourcesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Human Resources
                </h1>
                <p className="text-muted-foreground">
                Manage your employees, recruitment, payroll, and performance.
                </p>
            </div>
            <EmployeeListTable />
        </div>
    );
}
