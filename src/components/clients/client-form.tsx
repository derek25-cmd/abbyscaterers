
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientSchema, type ClientFormData } from "@/lib/schemas";
import type { Client } from "@/types";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, Info } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";

interface ClientFormProps {
  client?: Client; // For editing existing client
}

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter();
  const { addClient, updateClient } = useClientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(ClientSchema),
    defaultValues: client
      ? {
          ...client,
          lastContacted: client.lastContacted ? client.lastContacted : new Date().toISOString(),
        }
      : {
          id: "", // Client ID is now user-inputted
          companyName: "",
          companyEmail: "",
          phoneNumber: "",
          address1: "",
          address2: "",
          primaryLocation: "",
          lastContacted: new Date().toISOString(),
        },
  });
  
  useEffect(() => {
    // When editing, reset form with client data if client prop changes
    if (client) {
      form.reset({
        ...client,
        lastContacted: client.lastContacted ? client.lastContacted : new Date().toISOString(),
      });
    }
  }, [client, form]);


  async function onSubmit(data: ClientFormData) {
    setIsSubmitting(true);
    try {
      const payload: ClientFormData = {
        ...data,
        lastContacted: data.lastContacted ? new Date(data.lastContacted).toISOString() : new Date().toISOString(),
      };

      if (client) {
        // Update existing client, client.id is the original ID for lookup
        const updated = updateClient(client.id, payload); 
        if (updated) {
          toast({ title: "Client Updated", description: `${updated.companyName} (ID: ${updated.id}) has been updated.` });
          router.push(`/clients/${updated.id}`); // Navigate to new ID if it changed
        } else {
          // updateClient might return undefined if client not found, though less likely here
          toast({ variant: "destructive", title: "Error", description: "Failed to update client." });
        }
      } else {
        // Add new client
        const newClientData = addClient(payload);
        toast({ title: "Client Added", description: `${newClientData.companyName} (ID: ${newClientData.id}) has been added.` });
        router.push("/clients");
      }
    } catch (error: unknown) {
      console.error("Submission error:", error);
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({ variant: "destructive", title: "Submission Error", description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{client ? "Edit Client" : "Add New Client"}</CardTitle>
            <CardDescription>
              {client ? "Update the details for this client." : "Fill in the information for the new client."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CUST-001" {...field} />
                  </FormControl>
                  <FormDescription className="flex items-center gap-1">
                    <Info className="h-3 w-3" /> Enter a unique identifier for this client.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Awesome Catering Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g. contact@awesomecatering.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g. (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Downtown Conference Hall" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address 1</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address 2 (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Suite 100, Apt B" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="lastContacted"
                render={({ field }) => {
                  const dateValue = field.value ? parseISO(field.value) : undefined;
                  const isDateValid = dateValue && isValid(dateValue);
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Last Contacted</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {isDateValid && dateValue ? (
                                format(dateValue, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={isDateValid ? dateValue : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString())}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        The date this client was last contacted.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {client ? "Save Changes" : "Add Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
