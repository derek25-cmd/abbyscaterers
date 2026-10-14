
// @ts-nocheck
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CreditCard, Truck, CalendarCheck, History, FilePlus2, Award } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DOC_TYPE_LABELS, DOC_TYPE_ORDER, docTypeAppliesTo } from "@/lib/hr-docs/registry";
import { useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { NewDocumentWizard } from "@/components/hr/new-document-wizard";
import { useRouter } from "next/navigation";
import { isHrModuleOn, moduleOfDocType, useHrModules } from "@/lib/hr-modules";


export function EmployeeActionCenter({ employee }) {
    const router = useRouter();
    // null = closed; otherwise the letter type chosen from the menu.
    const [letterType, setLetterType] = useState(null);
    // Only the letters that make sense for this person right now (a certificate
    // of service once employment has ended, the others while Active).
    // ...and only those whose HR module is switched on.
    const modules = useHrModules();
    const letterTypes = DOC_TYPE_ORDER
        .filter((t) => t === 'general_letter' || docTypeAppliesTo(t, employee))
        .filter((t) => !!modules && isHrModuleOn(modules, moduleOfDocType(t)));
    const hasLeft = employee.status === 'Inactive' && !!employee.employmentEndDate
        && !!modules && isHrModuleOn(modules, 'letters');

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
                <RequirePermission permission="hr.manage">
                    {letterTypes.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <FilePlus2 className="mr-2 h-4 w-4" />
                                Generate letter
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Letters for {employee.firstName}</DropdownMenuLabel>
                            {letterTypes.map((t) => (
                                <DropdownMenuItem key={t} onClick={() => setLetterType(t)}>{DOC_TYPE_LABELS[t]}</DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                    {hasLeft && (
                        <Button onClick={() => setLetterType('certificate_of_service')}>
                            <Award className="mr-2 h-4 w-4" />
                            Generate Certificate of Service
                        </Button>
                    )}
                </RequirePermission>
            </CardContent>
            <NewDocumentWizard isOpen={!!letterType} setIsOpen={(o) => !o && setLetterType(null)} defaultEmployeeId={employee.id} defaultDocType={letterType ?? undefined} />
        </Card>
    )
}

