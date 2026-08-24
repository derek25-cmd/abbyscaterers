
// @ts-nocheck
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreditCard, Truck, CalendarCheck, History } from "lucide-react";
import { useRouter } from "next/navigation";


export function EmployeeActionCenter({ employee }) {
    const router = useRouter();

    const handleCreatePayslip = () => {
        router.push(`/hr/payroll?createPayslipFor=${employee.id}`);
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Action Center</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" asChild>
                    <Link href={`/hr/payroll?employeeId=${employee.id}`}>
                        <History className="mr-2 h-4 w-4" />
                        Payment History
                    </Link>
                </Button>
                <Button variant="outline" onClick={handleCreatePayslip}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Create Payslip
                </Button>
                <Button variant="outline" asChild>
                     <Link href={`/operations/issuance`}>
                        <Truck className="mr-2 h-4 w-4" />
                        Issue Assets
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href={`/hr/attendance?employeeId=${employee.id}`}>
                        <CalendarCheck className="mr-2 h-4 w-4" />
                        Attendance History
                    </Link>
                </Button>
            </CardContent>
        </Card>
    )
}

