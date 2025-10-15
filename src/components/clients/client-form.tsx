
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientSchema, type ClientFormData } from "@/lib/schemas";
import type { Client } from "@/types";
import { ORGANIZATION_TYPES } from "@/types";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, PlusCircle, Trash2 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface ClientFormProps {
  client?: Client; // For editing existing client
}

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter();
  const { addClient, updateClient, deleteClient } = useClientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(ClientSchema),
    defaultValues: client
      ? {
          ...client,
          lastContacted: client.lastContacted ? client.lastContacted : format(new Date(), 'yyyy-MM-dd'),
          contacts: client.contacts && client.contacts.length > 0 ? client.contacts : [{ name: "", email: "", phone: "" }]
        }
      : {
          id: "",
          companyName: "",
          companyEmail: "",
          phoneNumber: "",
          address1: "",
          address2: "",
          primaryLocation: "",
          typeOfOrganization: undefined,
          postalCode: "",
          lastContacted: format(new Date(), 'yyyy-MM-dd'),
          contacts: [],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "contacts"
  });
  
  useEffect(() => {
    if (client) {
      form.reset({
        ...client,
        lastContacted: client.lastContacted ? client.lastContacted : format(new Date(), 'yyyy-MM-dd'),
        contacts: client.contacts && client.contacts.length > 0 ? client.contacts : []
      });
    }
  }, [client, form]);


  async function onSubmit(data: ClientFormData) {
    setIsSubmitting(true);
    try {
      const payload: ClientFormData = {
        ...data,
        lastContacted: data.lastContacted ? format(new Date(data.lastContacted), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      };

      if (client) {
        const updated = await updateClient(client.id, payload);
        if (updated) {
          toast({ title: "Client Updated", description: `${payload.companyName} (ID: ${payload.id}) has been updated.` });
          router.push(`/clients/${payload.id}`);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to update client." });
        }
      } else {
        const newClientData = await addClient(payload);
        if (newClientData) {
            toast({ title: "Client Added", description: `${newClientData.companyName} (ID: ${newClientData.id}) has been added.` });
            router.push("/clients");
        }
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

  const handleDelete = () => {
    if (client) {
        deleteClient(client.id);
        toast({ title: "Client Deleted", description: "The client has been permanently removed."});
        router.push('/clients');
    }
  };

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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Customer Registration Number</FormLabel>
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="companyEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Email Address (Optional)</FormLabel>
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
                    <FormLabel>Company Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g. (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="typeOfOrganization"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Type of Organization</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an organization type" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {ORGANIZATION_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
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
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <FormLabel>Address 2 (P.O.BOX)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. P.O.BOX 12345" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
             </div>
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. 12345" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
             
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Contact Persons (Optional)</CardTitle>
                <CardDescription>Add one or more contact people for this client.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {fields.map((item, index) => (
              <div key={item.id} className="border p-4 rounded-lg relative space-y-4">
                 <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                 </Button>
                <FormField
                  control={form.control}
                  name={`contacts.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Jane Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name={`contacts.${index}.email`}
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl><Input type="email" placeholder="e.g. jane.doe@example.com" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name={`contacts.${index}.phone`}
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl><Input type="tel" placeholder="e.g. (555) 987-6543" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: "", email: "", phone: "" })}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
            </CardContent>
        </Card>

        <div className="flex justify-between items-center gap-4">
            <div>
              {client && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" disabled={isSubmitting}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Client
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the client
                                <span className="font-semibold text-foreground"> {client.companyName}</span> and all associated data.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {client ? "Save Changes" : "Add Client"}
                </Button>
            </div>
        </div>
      </form>
    </Form>
  );
}
