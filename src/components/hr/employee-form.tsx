
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmployeeSchema, type EmployeeFormData, DEPARTMENTS, EMPLOYMENT_TYPES } from "@/lib/schemas";
import type { Employee } from "@/types";
import { useEmployeeStorage } from "@/hooks/use-employee-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface EmployeeFormProps {
  employee?: Employee;
}

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const router = useRouter();
  const { addEmployee, updateEmployee } = useEmployeeStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: employee || {
      employeeId: `EMP-${Date.now()}`,
      fullName: "",
      position: "",
      department: undefined,
      employmentType: undefined,
      dateOfBirth: "",
      hireDate: new Date().toISOString(),
      email: "",
      phone: "",
      address: "",
    },
  });

  async function onSubmit(data: EmployeeFormData) {
    setIsSubmitting(true);
    try {
      if (employee) {
        const updated = updateEmployee(employee.employeeId, data);
        toast({ title: "Employee Updated", description: `${updated?.fullName}'s record has been updated.` });
        router.push("/hr");
      } else {
        addEmployee(data);
        toast({ title: "Employee Added", description: `${data.fullName} has been added to the system.` });
        router.push("/hr");
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save employee data." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{employee ? "Edit Employee Information" : "Add New Employee"}</CardTitle>
            <CardDescription>
              {employee ? "Update the details for this employee." : "Fill in the information for the new employee."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="employeeId" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="fullName" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g. John Doe" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="position" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Position / Title</FormLabel><FormControl><Input placeholder="e.g. Head Chef" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="department" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger></FormControl>
                        <SelectContent>{DEPARTMENTS.map(dep => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}</SelectContent>
                    </Select>
                <FormMessage /></FormItem>
              )}/>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField name="employmentType" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Employment Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select employment type" /></SelectTrigger></FormControl>
                            <SelectContent>{EMPLOYMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                )}/>
                <FormField name="hireDate" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Hire Date</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={new Date(field.value)} onSelect={(d) => field.onChange(d?.toISOString())} initialFocus />
                        </PopoverContent>
                        </Popover>
                    <FormMessage /></FormItem>
                )}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField name="email" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="e.g. john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField name="phone" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="e.g. +1 234 567 890" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
            <FormField name="address" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="e.g. 123 Main St, Anytown, USA" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {employee ? "Save Changes" : "Add Employee"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
