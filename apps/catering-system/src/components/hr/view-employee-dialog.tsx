
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EmployeeActionCenter } from "./employee-action-center";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeLeaveTab } from "@/components/leave/employee-leave-tab";
import { EmployeeDocumentsTab } from "@/components/hr/employee-documents-tab";
import { RequirePermission } from "@/components/auth/require-permission";
import { HrModuleOnly } from "@/components/hr/hr-module-gate";
import { ActiveWarningsBadge, EmployeeContractsTab, EmployeeDisciplinaryTab, EmployeeRecognitionTab } from "@/components/hr/employee-records-tabs";

export function ViewEmployeeDialog({ isOpen, setIsOpen, employee }) {
  if (!employee) return null;

  const getFullName = (employee) => {
    return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
  }
  
  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const DetailRow = ({ label, value, isBadge, badgeVariant, badgeClass, isCurrency }) => (
    <div className="grid grid-cols-3 items-center gap-4 py-2">
      <Label className="text-right font-semibold">{label}</Label>
      {isBadge ? (
        <Badge variant={badgeVariant} className={`col-span-2 ${badgeClass}`}>
          {value}
        </Badge>
      ) : (
        <span className="col-span-2 text-sm">{isCurrency ? formatCurrency(value) : (value || 'N/A')}</span>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Employee Details
              {employee.status !== 'Active' && <Badge variant="outline">{employee.status}</Badge>}
              <HrModuleOnly module="letters"><RequirePermission permission="hr.manage"><ActiveWarningsBadge employeeId={employee.id} /></RequirePermission></HrModuleOnly>
            </DialogTitle>
            <DialogDescription>
              Viewing details for {getFullName(employee)}.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <HrModuleOnly module="leave"><TabsTrigger value="leave">Leave</TabsTrigger></HrModuleOnly>
            <RequirePermission permission="hr.manage">
              <HrModuleOnly module="letters">
                <TabsTrigger value="contracts">Contracts</TabsTrigger>
                <TabsTrigger value="disciplinary">Disciplinary</TabsTrigger>
                <TabsTrigger value="recognition">Recognition</TabsTrigger>
              </HrModuleOnly>
              <HrModuleOnly module="documents"><TabsTrigger value="documents">Documents</TabsTrigger></HrModuleOnly>
            </RequirePermission>
          </TabsList>
          <TabsContent value="details">
          <ScrollArea className="h-[70vh] p-4">
            <div className="space-y-6">
                <div>
                    <h3 className="mb-2 text-lg font-medium text-primary">Personal Information</h3>
                    <DetailRow label="Employee ID" value={employee.id} />
                    <DetailRow label="Full Name" value={getFullName(employee)} />
                    <DetailRow label="Date of Birth" value={employee.dob} />
                    <DetailRow label="Gender" value={employee.gender} />
                </div>
                <Separator />
                 <div>
                    <h3 className="mb-2 text-lg font-medium text-primary">Identification</h3>
                    <DetailRow label="Nationality" value={employee.nationality} />
                    <DetailRow label="National ID / Passport" value={employee.nationalId} />
                    <DetailRow label="TIN" value={employee.tin} />
                </div>
                <Separator />
                <div>
                    <h3 className="mb-2 text-lg font-medium text-primary">Contact Details</h3>
                    <DetailRow label="Phone Number" value={employee.phone} />
                    <DetailRow label="Email Address" value={employee.email} />
                    <DetailRow label="Residential Address" value={employee.address} />
                </div>
                <Separator />
                <div>
                    <h3 className="mb-2 text-lg font-medium text-primary">Emergency Contact</h3>
                    <DetailRow label="Name" value={employee.emergencyContactName} />
                    <DetailRow label="Relationship" value={employee.emergencyContactRelationship} />
                    <DetailRow label="Phone Number" value={employee.emergencyContactPhone} />
                </div>
                <Separator />
                <div>
                    <h3 className="mb-2 text-lg font-medium text-primary">Job Information</h3>
                    <DetailRow label="Role" value={employee.role} />
                    <DetailRow label="Department" value={employee.department} />
                    <DetailRow label="Monthly Salary" value={employee.monthlySalary} isCurrency />
                    <DetailRow
                        label="Status"
                        value={employee.status}
                        isBadge
                        badgeVariant={employee.status === 'Active' ? 'default' : 'outline'}
                        badgeClass={employee.status === 'Active' ? 'bg-accent text-accent-foreground' : ''}
                    />
                </div>
                {employee.status === 'Inactive' && (employee.employmentEndDate || employee.employmentEndReason) && (
                  <>
                    <Separator />
                    <div>
                        <h3 className="mb-2 text-lg font-medium text-destructive">Employment End</h3>
                        <DetailRow label="Last Working Date" value={employee.employmentEndDate} />
                        <DetailRow label="Reason" value={employee.employmentEndReason} />
                    </div>
                  </>
                )}
                 <Separator />
                 <EmployeeActionCenter employee={employee} />
            </div>
          </ScrollArea>
          </TabsContent>
          <TabsContent value="leave">
            <ScrollArea className="h-[70vh] p-4">
              <EmployeeLeaveTab employeeId={employee.id} employeeName={getFullName(employee)} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="contracts">
            <ScrollArea className="h-[70vh] p-4"><RequirePermission permission="hr.manage"><EmployeeContractsTab employee={employee} /></RequirePermission></ScrollArea>
          </TabsContent>
          <TabsContent value="disciplinary">
            <ScrollArea className="h-[70vh] p-4"><RequirePermission permission="hr.manage"><EmployeeDisciplinaryTab employee={employee} /></RequirePermission></ScrollArea>
          </TabsContent>
          <TabsContent value="recognition">
            <ScrollArea className="h-[70vh] p-4"><RequirePermission permission="hr.manage"><EmployeeRecognitionTab employee={employee} /></RequirePermission></ScrollArea>
          </TabsContent>
          <TabsContent value="documents">
            <ScrollArea className="h-[70vh] p-4">
              <EmployeeDocumentsTab employeeId={employee.id} employeeName={getFullName(employee)} />
            </ScrollArea>
          </TabsContent>
          </Tabs>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
