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
import { Label } from "@/components/ui/label";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { format, parseISO } from "date-fns";

export function ViewPayslipDialog({ isOpen, setIsOpen, payslip }) {
  if (!payslip) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const DetailRow = ({ label, value, className = '' }) => (
    <div className="flex justify-between items-center py-2">
      <Label className="font-semibold">{label}</Label>
      <span className={`text-sm ${className}`}>{value}</span>
    </div>
  );

  const getStatusBadge = (status) => {
    if (status === 'Paid') {
        return <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">Paid</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payslip Details</DialogTitle>
            <DialogDescription>
              Viewing payslip for {payslip.employeeName}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-4 border rounded-md">
            <div className="space-y-4">
                <div className="text-center">
                    <h3 className="text-xl font-bold font-headline">CaterEase Inc.</h3>
                    <p className="text-sm text-muted-foreground">Payslip</p>
                </div>
                <Separator/>
                <div>
                    <DetailRow label="Payslip ID" value={payslip.id} />
                    <DetailRow label="Employee Name" value={payslip.employeeName} />
                    <DetailRow label="Employee ID" value={payslip.employeeId} />
                    <DetailRow label="Pay Period" value={`${format(parseISO(payslip.payPeriodStart), 'MMM dd, yyyy')} - ${format(parseISO(payslip.payPeriodEnd), 'MMM dd, yyyy')}`} />
                </div>
                <Separator />
                 <div>
                    <h4 className="mb-2 text-lg font-medium text-primary">Earnings</h4>
                    <DetailRow label="Basic Salary" value={formatCurrency(payslip.basicSalary)} />
                    <DetailRow label="Allowances" value={formatCurrency(payslip.allowances)} />
                    <Separator className="my-1"/>
                    <DetailRow label="Gross Salary" value={formatCurrency(payslip.grossSalary)} className="font-bold text-base" />
                </div>
                <Separator />
                <div>
                    <h4 className="mb-2 text-lg font-medium text-primary">Deductions</h4>
                    <DetailRow label="Total Deductions" value={formatCurrency(payslip.deductions)} />
                </div>
                <Separator />
                <div className="bg-muted p-3 rounded-md">
                     <DetailRow label="Net Salary" value={formatCurrency(payslip.netSalary)} className="font-bold text-lg text-primary" />
                </div>
                <Separator />
                 <div>
                    <h4 className="mb-2 text-lg font-medium text-primary">Payment Details</h4>
                    <div className="flex justify-between items-center py-2">
                        <Label className="font-semibold">Status</Label>
                        {getStatusBadge(payslip.status)}
                    </div>
                    <DetailRow label="Payment Date" value={payslip.paymentDate ? format(parseISO(payslip.paymentDate), 'MMM dd, yyyy') : 'N/A'} />
                </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
