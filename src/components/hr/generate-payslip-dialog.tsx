// @ts-nocheck
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { format } from "date-fns";

export function GeneratePayslipDialog({ isOpen, setIsOpen, employees, onGeneratePayslip }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    payPeriodStart: '',
    payPeriodEnd: '',
    basicSalary: 0,
    allowances: 0,
    deductions: 0,
  });

  const resetForm = () => {
    setFormData({
        employeeId: '',
        payPeriodStart: '',
        payPeriodEnd: '',
        basicSalary: 0,
        allowances: 0,
        deductions: 0,
    });
  }

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  }

  const handleSelectChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  }
  
  const handleNumberChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!formData.employeeId || !formData.payPeriodStart || !formData.payPeriodEnd) {
        alert("Please fill all required fields");
        return;
    }

    onGeneratePayslip(formData);
    resetForm();
    setIsOpen(false);
  };

  const getFullName = (employee) => {
    return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Generate New Payslip</DialogTitle>
            <DialogDescription>
              Enter the details to generate a payslip for an employee.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-4">
            <div className="grid gap-6">
                <div>
                    <Label htmlFor="employeeId">Employee</Label>
                    <Select onValueChange={(value) => handleSelectChange('employeeId', value)} value={formData.employeeId}>
                        <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                        <SelectContent>
                        {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{getFullName(emp)}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
              <h3 className="text-lg font-medium">Pay Period</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="payPeriodStart">Start Date</Label>
                    <Input id="payPeriodStart" type="date" value={formData.payPeriodStart} onChange={handleChange} />
                </div>
                 <div>
                    <Label htmlFor="payPeriodEnd">End Date</Label>
                    <Input id="payPeriodEnd" type="date" value={formData.payPeriodEnd} onChange={handleChange} />
                </div>
              </div>

               <h3 className="text-lg font-medium">Salary Details</h3>
               <div className="grid gap-4">
                   <div>
                       <Label htmlFor="basicSalary">Basic Salary (TZS)</Label>
                       <Input id="basicSalary" type="number" value={formData.basicSalary} onChange={handleNumberChange} />
                   </div>
                   <div>
                       <Label htmlFor="allowances">Allowances (TZS)</Label>
                       <Input id="allowances" type="number" value={formData.allowances} onChange={handleNumberChange} />
                   </div>
                   <div>
                       <Label htmlFor="deductions">Deductions (TZS)</Label>
                       <Input id="deductions" type="number" value={formData.deductions} onChange={handleNumberChange} />
                   </div>
               </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>
            </DialogClose>
            <Button type="submit">Generate Payslip</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
