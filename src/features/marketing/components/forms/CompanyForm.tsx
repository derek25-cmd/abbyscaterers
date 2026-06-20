"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateCompany, useRegions, useMarketersList, useUpdateCompany } from "../../hooks/useMarketingQuery";
import type { Company } from "../../types";

const companySchema = z.object({
  name: z.string().min(2, "Company name is required"),
  industry: z.string().optional(),
  businessSize: z.enum(["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]).optional(),
  employeeCount: z.coerce.number().min(0).optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  regionId: z.string().optional(),
  contactName: z.string().optional(),
  contactPosition: z.string().optional(),
  contactPhone: z.string().regex(/^(\+255|0)[0-9]{9,10}$/, "Invalid Tanzanian phone number").optional().or(z.literal("")),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  assignedMarketerId: z.string().optional(),
  currentCaterer: z.string().optional(),
  competitorNotes: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

function companyToFormValues(company?: Company): CompanyFormValues {
  if (!company) return { name: "" };
  return {
    name: company.name,
    industry: company.industry ?? undefined,
    businessSize: company.business_size ?? undefined,
    employeeCount: company.employee_count ?? undefined,
    address: company.address ?? undefined,
    latitude: company.latitude ?? undefined,
    longitude: company.longitude ?? undefined,
    regionId: company.region_id ?? undefined,
    contactName: company.contact_name ?? undefined,
    contactPosition: company.contact_position ?? undefined,
    contactPhone: company.contact_phone ?? undefined,
    contactEmail: company.contact_email ?? undefined,
    assignedMarketerId: company.assigned_marketer_id ?? undefined,
    currentCaterer: company.current_caterer ?? undefined,
    competitorNotes: company.current_caterer_notes ?? undefined,
    estimatedValue: company.estimated_value ?? undefined,
  };
}

export function CompanyForm({
  open,
  onOpenChange,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
}) {
  const { toast } = useToast();
  const { data: regions } = useRegions();
  const { data: marketers } = useMarketersList();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const isEdit = Boolean(company);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: companyToFormValues(company),
  });

  useEffect(() => {
    if (open) form.reset(companyToFormValues(company));
  }, [open, company, form]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Geolocation unavailable", description: "Your browser doesn't support this feature." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude);
        form.setValue("longitude", position.coords.longitude);
      },
      () => toast({ variant: "destructive", title: "Location unavailable", description: "Could not read your current position." })
    );
  };

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      if (isEdit && company) {
        await updateCompany.mutateAsync({ id: company.id, input: values });
        toast({ title: "Company updated", description: `${values.name} has been updated.` });
      } else {
        await createCompany.mutateAsync(values);
        toast({ title: "Company added", description: `${values.name} has been added to the pipeline.` });
      }
      onOpenChange(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Something went wrong", description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const isSubmitting = createCompany.isPending || updateCompany.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Company" : "Add Company"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this prospect's details." : "Add a new prospect to the marketing pipeline."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Company name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="businessSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Business size</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="SMALL">Small</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LARGE">Large</SelectItem>
                      <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="employeeCount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee count</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="regionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {regions?.map((region) => (
                        <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex items-end gap-2 sm:col-span-2">
                <FormField control={form.control} name="latitude" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Latitude</FormLabel>
                    <FormControl><Input type="number" step="any" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="longitude" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Longitude</FormLabel>
                    <FormControl><Input type="number" step="any" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="button" variant="outline" onClick={useMyLocation} className="shrink-0">
                  <MapPin className="mr-2 h-4 w-4" /> Use my location
                </Button>
              </div>

              <FormField control={form.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact name</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="contactPosition" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact position</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="contactPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact phone</FormLabel>
                  <FormControl><Input placeholder="0712345678" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="contactEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact email</FormLabel>
                  <FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="assignedMarketerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned marketer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select marketer" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {marketers?.map((marketer) => (
                        <SelectItem key={marketer.id} value={marketer.id}>{marketer.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="estimatedValue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated monthly value (TZS)</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="currentCaterer" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current caterer (competitor)</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="competitorNotes" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Competitor notes</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Add Company"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
