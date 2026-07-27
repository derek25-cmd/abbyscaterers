
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatTZS } from "@/lib/formatCurrency";
import { exportPayslipPdf } from "@/lib/payslipPdf";
import type { Payroll, Employee } from "@/types";

interface ViewPayslipDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  payslip: Payroll | null;
  employee?: Employee | null;
}

export function ViewPayslipDialog({ isOpen, setIsOpen, payslip, employee }: ViewPayslipDialogProps) {
  if (!payslip) return null;

  const DetailRow = ({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) => (
    <div className="flex justify-between items-center py-2">
      <Label className="font-semibold">{label}</Label>
      <span className={`text-sm ${className}`}>{value}</span>
    </div>
  );

  const getStatusBadge = (status: string) => {
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
                    <h3 className="text-xl font-bold font-headline">Abby&apos;s Legendary Caterers Limited</h3>
                    <p className="text-sm text-muted-foreground">Payslip</p>
                </div>
                <Separator/>
                <div>
                    <DetailRow label="Payslip ID" value={payslip.id} />
                    <DetailRow label="Employee Name" value={payslip.employeeName} />
                    <DetailRow label="Employee ID" value={payslip.employeeId} />
                    <DetailRow label="Staff Type" value={payslip.staff_type === 'casual' ? 'Casual' : 'Permanent'} />
                    <DetailRow label="Pay Period" value={`${format(parseISO(payslip.payPeriodStart), 'MMM dd, yyyy')} - ${format(parseISO(payslip.payPeriodEnd), 'MMM dd, yyyy')}`} />
                </div>
                <Separator />
                 <div>
                    <h4 className="mb-2 text-lg font-medium text-primary">Earnings</h4>
                    <DetailRow label="Basic Salary" value={formatTZS(payslip.basicSalary)} />
                    <DetailRow label="Allowances" value={formatTZS(payslip.allowances)} />
                    <Separator className="my-1"/>
                    <DetailRow label="Gross Salary" value={formatTZS(payslip.grossSalary)} className="font-bold text-base" />
                </div>
                <Separator />
                <div>
                    <h4 className="mb-2 text-lg font-medium text-primary">Deductions</h4>
                    <DetailRow label="PAYE (Income Tax)" value={formatTZS(payslip.paye_amount ?? 0)} />
                    <DetailRow label="NSSF (Employee)" value={formatTZS(payslip.nssf_employee ?? 0)} />
                    <DetailRow label="Other Deductions" value={formatTZS(payslip.other_deductions ?? 0)} />
                    <Separator className="my-1"/>
                    <DetailRow label="Total Deductions" value={formatTZS(payslip.deductions)} className="font-bold text-base" />
                </div>
                <Separator />
                <div className="bg-muted p-3 rounded-md">
                     <DetailRow label="Net Salary" value={formatTZS(payslip.netSalary)} className="font-bold text-lg text-primary" />
                </div>
                <Separator />
                <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">Employer Cost (not deducted from employee)</h4>
                    <DetailRow label="NSSF (Employer)" value={formatTZS(payslip.nssf_employer ?? 0)} />
                    <DetailRow label="SDL" value={formatTZS(payslip.sdl_amount ?? 0)} />
                    <DetailRow label="WCF" value={formatTZS(payslip.wcf_contrib ?? 0)} />
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
          <DialogFooter className="pt-4 gap-2">
            <Button type="button" variant="secondary" onClick={() => exportPayslipPdf(payslip, employee ?? null)}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
