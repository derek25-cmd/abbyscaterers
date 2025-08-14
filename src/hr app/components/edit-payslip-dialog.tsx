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
import { useState, useEffect } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { format, parseISO } from "date-fns";

export function EditPayslipDialog({ isOpen, setIsOpen, payslip, onEditPayslip }) {
    const [formData, setFormData] = useState({
        payPeriodStart: '',
        payPeriodEnd: '',
        basicSalary: 0,
        allowances: 0,
        deductions: 0,
    });

  useEffect(() => {
    if (payslip) {
      setFormData({
        payPeriodStart: format(parseISO(payslip.payPeriodStart), 'yyyy-MM-dd'),
        payPeriodEnd: format(parseISO(payslip.payPeriodEnd), 'yyyy-MM-dd'),
        basicSalary: payslip.basicSalary,
        allowances: payslip.allowances,
        deductions: payslip.deductions,
      });
    }
  }, [payslip]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  }
  
  const handleNumberChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!formData.payPeriodStart || !formData.payPeriodEnd) {
        alert("Please fill all required fields");
        return;
    }

    onEditPayslip({
      ...payslip,
      ...formData
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Payslip</DialogTitle>
            <DialogDescription>
              Update the details for the payslip of {payslip?.employeeName}.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-4">
            <div className="grid gap-6">
                
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
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
