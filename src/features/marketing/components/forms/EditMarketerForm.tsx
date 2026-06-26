"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpdateMarketer, useRegions } from "../../hooks/useMarketingQuery";

const editMarketerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().optional(),
  role: z.enum(["MARKETER", "MARKETING_MANAGER"]),
  regionId: z.string().optional(),
});

type EditMarketerFormValues = z.infer<typeof editMarketerSchema>;

export function EditMarketerForm({
  open,
  onOpenChange,
  marketer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string; phone: string | null; role: string; regionId: string | null };
}) {
  const { toast } = useToast();
  const { data: regions } = useRegions();
  const updateMarketer = useUpdateMarketer();

  const form = useForm<EditMarketerFormValues>({
    resolver: zodResolver(editMarketerSchema),
    defaultValues: {
      fullName: marketer.fullName,
      phone: marketer.phone ?? "",
      role: marketer.role === "MARKETING_MANAGER" ? "MARKETING_MANAGER" : "MARKETER",
      regionId: marketer.regionId ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: marketer.fullName,
        phone: marketer.phone ?? "",
        role: marketer.role === "MARKETING_MANAGER" ? "MARKETING_MANAGER" : "MARKETER",
        regionId: marketer.regionId ?? undefined,
      });
    }
  }, [open, marketer, form]);

  const onSubmit = async (values: EditMarketerFormValues) => {
    try {
      await updateMarketer.mutateAsync({ id: marketer.id, input: values });
      toast({ title: "Profile updated" });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not update profile",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Marketer Profile</DialogTitle>
          <DialogDescription>Update this marketer&apos;s details. Email cannot be changed here.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="fullName" render={({ field }) => (
              <FormItem>
                <FormLabel>Full name *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="MARKETER">Marketer</SelectItem>
                    <SelectItem value="MARKETING_MANAGER">Marketing Manager</SelectItem>
                  </SelectContent>
                </Select>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMarketer.isPending}>
                {updateMarketer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
