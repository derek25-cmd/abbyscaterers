// @ts-nocheck
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, DollarSign, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

import { GeneratePayslipDialog } from "@/components/hr/generate-payslip-dialog";
import { EditPayslipDialog } from "@/components/hr/edit-payslip-dialog";
import { ViewPayslipDialog } from "@/components/hr/view-payslip-dialog";
import { getPayrolls, addPayroll, updatePayroll } from "@/services/payrollService";
import { getEmployees } from "@/services/employeeService";

export default function PayrollPage() {
    const [payrolls, setPayrolls] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [selectedPayslip, setSelectedPayslip] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [payrollsData, employeesData] = await Promise.all([
                getPayrolls(),
                getEmployees()
            ]);
            setPayrolls(payrollsData);
            setEmployees(employeesData);
            setLoading(false);
        }
        fetchData();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
    }
    
    const handleGeneratePayslip = async (payslipData) => {
        const employee = employees.find(e => e.id === payslipData.employeeId);
        if (!employee) return;

        const grossSalary = payslipData.basicSalary + payslipData.allowances;
        const netSalary = grossSalary - payslipData.deductions;

        const newPayslip = {
            ...payslipData,
            employeeName: [employee.firstName, employee.lastName].join(' '),
            grossSalary,
            netSalary,
            status: 'Pending',
            paymentDate: null,
        };
        const newId = await addPayroll(newPayslip);
        setPayrolls(prev => [{ id: newId, ...newPayslip }, ...prev]);
    };

    const handleEditPayslip = async (updatedPayslip) => {
        const grossSalary = updatedPayslip.basicSalary + updatedPayslip.allowances;
        const netSalary = grossSalary - updatedPayslip.deductions;
        const payload = {
            ...updatedPayslip,
            grossSalary,
            netSalary,
        };
        await updatePayroll(payload.id, payload);
        setPayrolls(prev => 
            prev.map(p => p.id === payload.id ? payload : p)
        );
    };

    const handleMarkAsPaid = async (payslipId) => {
        const payslip = payrolls.find(p => p.id === payslipId);
        if (payslip) {
            const updatedPayslip = { 
                ...payslip, 
                status: 'Paid',
                paymentDate: format(new Date(), "yyyy-MM-dd")
            };
            await updatePayroll(payslipId, updatedPayslip);
            setPayrolls(payrolls.map(p => p.id === payslipId ? updatedPayslip : p));
        }
    };
    
    const openEditDialog = (payslip) => {
        setSelectedPayslip(payslip);
        setIsEditDialogOpen(true);
    };

    const openViewDialog = (payslip) => {
        setSelectedPayslip(payslip);
        setIsViewDialogOpen(true);
    };
    
    const getStatusBadge = (status) => {
        if (status === 'Paid') {
            return <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">Paid</Badge>;
        }
        return <Badge variant="outline">Pending</Badge>;
    };

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Payroll Management</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="h-8 gap-1" onClick={() => setIsGenerateDialogOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Generate Payslip
              </span>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Payslip History</CardTitle>
            <CardDescription>
              Manage and track all employee payslips.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <p>Loading payrolls...</p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payslip ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.id}</TableCell>
                    <TableCell>{p.employeeName}</TableCell>
                    <TableCell>{`${format(new Date(p.payPeriodStart), 'LLL dd, y')} - ${format(new Date(p.payPeriodEnd), 'LLL dd, y')}`}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.netSalary)}</TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                    <TableCell>{p.paymentDate || 'N/A'}</TableCell>
                    <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openViewDialog(p)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(p)}>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {p.status !== 'Paid' && (
                                <DropdownMenuItem onClick={() => handleMarkAsPaid(p.id)}>Mark as Paid</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      
      <GeneratePayslipDialog
        isOpen={isGenerateDialogOpen}
        setIsOpen={setIsGenerateDialogOpen}
        employees={employees.filter(e => e.status === 'Active')}
        onGeneratePayslip={handleGeneratePayslip}
      />
      {selectedPayslip && (
          <EditPayslipDialog
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
            payslip={selectedPayslip}
            onEditPayslip={handleEditPayslip}
          />
      )}
      {selectedPayslip && (
          <ViewPayslipDialog
            isOpen={isViewDialogOpen}
            setIsOpen={setIsViewDialogOpen}
            payslip={selectedPayslip}
          />
      )}
    </main>
  );
}
