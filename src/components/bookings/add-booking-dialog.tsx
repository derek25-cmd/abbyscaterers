
"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookingSchema, type BookingFormData } from '@/lib/schemas';
import { useBookingStorage } from '@/hooks/use-booking-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface AddBookingDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function AddBookingDialog({ isOpen, setIsOpen }: AddBookingDialogProps) {
  const { addBooking } = useBookingStorage();
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(BookingSchema),
    defaultValues: {
      name: '',
      clientId: '',
      startDate: new Date().toISOString(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
      status: 'pending',
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    try {
      // We no longer provide the ID, so we omit it from the data sent to addBooking
      const { id, ...bookingData } = data;
      await addBooking(bookingData);
      toast({ title: "Booking Created", description: "The new long-term booking has been added." });
      form.reset();
      setIsOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create booking." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Booking</DialogTitle>
            <DialogDescription>Enter the details for the new long-term booking/contract.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Controller name="name" control={form.control} render={({ field }) => (
                <div><Label>Booking Name</Label><Input {...field} placeholder="e.g. NMB Bank - October Lunch" /></div>
            )}/>
            <Controller name="clientId" control={form.control} render={({ field }) => (
                <div><Label>Client</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={clientsLoading}>
                                {clientsLoading ? "Loading..." : field.value ? clients.find(c => c.id === field.value)?.companyName : "Select client"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command><CommandInput placeholder="Search client..." /><CommandList><CommandEmpty>No client found.</CommandEmpty><CommandGroup>
                                {clients.map((c) => (<CommandItem key={c.id} value={c.companyName} onSelect={() => field.onChange(c.id)}>
                                    <Check className={cn("mr-2 h-4 w-4", c.id === field.value ? "opacity-100" : "opacity-0")} />{c.companyName}
                                </CommandItem>))}
                            </CommandGroup></CommandList></Command>
                        </PopoverContent>
                    </Popover>
                </div>
            )}/>
            <div className="grid grid-cols-2 gap-4">
                <Controller name="startDate" control={form.control} render={({ field }) => (
                    <div><Label>Start Date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date(field.value)} onSelect={(d) => d && field.onChange(d.toISOString())} /></PopoverContent>
                    </Popover></div>
                )}/>
                 <Controller name="endDate" control={form.control} render={({ field }) => (
                    <div><Label>End Date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date(field.value)} onSelect={(d) => d && field.onChange(d.toISOString())} /></PopoverContent>
                    </Popover></div>
                )}/>
            </div>
             <Controller name="status" control={form.control} render={({ field }) => (
                <div><Label>Initial Status</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}/>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create Booking</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
