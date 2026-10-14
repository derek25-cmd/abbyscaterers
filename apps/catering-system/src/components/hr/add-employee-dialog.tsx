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
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEPARTMENTS } from "@/lib/schemas";

/**
 * initialValues: pre-fills the form (Candidates → Convert to employee).
 * title / description: override the heading for that case.
 */
interface AddEmployeeDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onAddEmployee: (employee: Record<string, unknown>) => Promise<unknown>;
  initialValues?: Record<string, unknown> | null;
  title?: string | null;
  description?: string | null;
}

export function AddEmployeeDialog({ isOpen, setIsOpen, onAddEmployee, initialValues = null, title = null, description = null }: AddEmployeeDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    gender: '',
    nationality: '',
    nationalId: '',
    tin: '',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    role: '',
    department: '',
    status: 'Active',
    employmentStartDate: '',
    monthlySalary: 0,
    bankName: '',
    bankAccountNumber: '',
    nssfNumber: '',
  });

  const resetForm = () => {
    setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        dob: '',
        gender: '',
        nationality: '',
        nationalId: '',
        tin: '',
        phone: '',
        email: '',
        address: '',
        emergencyContactName: '',
        emergencyContactRelationship: '',
        emergencyContactPhone: '',
        role: '',
        department: '',
        status: 'Active',
        employmentStartDate: '',
        monthlySalary: 0,
        bankName: '',
        bankAccountNumber: '',
        nssfNumber: '',
    });
  }

  // Each time the dialog opens with values to pre-fill, start from them.
  useEffect(() => {
    if (isOpen && initialValues) setFormData((prev) => ({ ...prev, ...initialValues, status: 'Active' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialValues]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  }

  const handleSelectChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.firstName || !formData.lastName || !formData.role || !formData.department) {
        alert("Please fill all required fields");
        return;
    }

    setSubmitting(true);
    try {
      // A new employee is always Active: employment is ended only through a
      // termination letter or "End employment without a letter".
      await onAddEmployee({...formData, status: 'Active', monthlySalary: Number(formData.monthlySalary)});
      resetForm();
      setIsOpen(false);
    } catch {
      // Error is already surfaced via toast by the caller — keep the
      // dialog open with the entered data so the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title ?? 'Add New Employee'}</DialogTitle>
            <DialogDescription>
              {description ?? 'Enter the details for the new employee.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-4">
            <div className="grid gap-6">
              <h3 className="text-lg font-medium">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" value={formData.firstName} onChange={handleChange} />
                  </div>
                  <div>
                      <Label htmlFor="middleName">Middle Name</Label>
                      <Input id="middleName" value={formData.middleName} onChange={handleChange} />
                  </div>
                  <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" value={formData.lastName} onChange={handleChange} />
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" value={formData.dob} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select onValueChange={(value) => handleSelectChange('gender', value)} value={formData.gender}>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a gender" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>

               <h3 className="text-lg font-medium">Identification</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                       <Label htmlFor="nationality">Nationality</Label>
                       <Input id="nationality" value={formData.nationality} onChange={handleChange} />
                   </div>
                   <div>
                       <Label htmlFor="nationalId">National ID / Passport</Label>
                       <Input id="nationalId" value={formData.nationalId} onChange={handleChange} />
                   </div>
                   <div>
                       <Label htmlFor="tin">Tax Identification Number (TIN)</Label>
                       <Input id="tin" value={formData.tin} onChange={handleChange} />
                   </div>
               </div>

                <h3 className="text-lg font-medium">Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" value={formData.phone} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" value={formData.email} onChange={handleChange} />
                    </div>
                </div>
                 <div>
                    <Label htmlFor="address">Residential Address</Label>
                    <Input id="address" value={formData.address} onChange={handleChange} />
                </div>

                <h3 className="text-lg font-medium">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="emergencyContactName">Contact Name</Label>
                        <Input id="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                        <Input id="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                        <Input id="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} />
                    </div>
                </div>
                
                <h3 className="text-lg font-medium">Job Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="role">Role</Label>
                        <Input id="role" value={formData.role} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="department">Department</Label>
                        <Select onValueChange={(value) => handleSelectChange('department', value)} value={formData.department}>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="monthlySalary">Monthly Salary (TZS)</Label>
                        <Input id="monthlySalary" type="number" value={formData.monthlySalary} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="employmentStartDate">Employment Start Date</Label>
                        <Input id="employmentStartDate" type="date" value={formData.employmentStartDate} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="status">Status</Label>
                        <p id="status" className="flex h-10 items-center text-sm text-muted-foreground">Active (new employees always start as Active)</p>
                    </div>
                </div>

                <h3 className="text-lg font-medium">Payroll Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="nssfNumber">NSSF Number</Label>
                        <Input id="nssfNumber" value={formData.nssfNumber} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input id="bankName" value={formData.bankName} onChange={handleChange} />
                    </div>
                    <div>
                        <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
                        <Input id="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} />
                    </div>
                </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>{submitting ? "Adding..." : "Add Employee"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
