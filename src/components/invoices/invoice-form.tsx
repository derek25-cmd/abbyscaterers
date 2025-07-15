
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, Eye, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useInvoiceStorage } from '@/hooks/use-invoice-storage';
import { InvoiceSchema, type InvoiceFormData } from '@/lib/schemas';
import { InvoicePreview } from './invoice-preview';

const eventTypes = [
  'Catering services',
  'Refreshments',
  'Conference package',
  'Wedding',
  'Confirmation',
  'Funeral',
  'Custom'
];

const mealTypes = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Breakfast and lunch',
  'Breakfast, lunch and evening tea',
  'Breakfast, lunch and dinner',
  'Evening tea',
  'Brunch',
];

const serviceFieldsList = [
  { key: 'eventType', label: 'Event Type' },
  { key: 'mealType', label: 'Meal Type' },
  { key: 'pax', label: 'Total Pax' },
  { key: 'numberOfDays', label: 'Number of Days' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'location', label: 'Location' }
];

export function InvoiceForm() {
    const router = useRouter();
    const params = useParams();
    const { clients, isLoading: clientsLoading } = useClientStorage();
    const { getInvoiceById, addInvoice, updateInvoice, isLoading: invoicesLoading } = useInvoiceStorage();
    const { toast } = useToast();

    const invoiceId = typeof params.id === 'string' ? params.id : undefined;
    const isEditMode = !!invoiceId;

    const [showPreview, setShowPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<InvoiceFormData>({
        resolver: zodResolver(InvoiceSchema),
        defaultValues: {
            id: "",
            invoiceDate: new Date().toISOString(),
            clientId: null,
            receiverName: '',
            receiverPosition: '',
            lpoNumber: '',
            location: '',
            numberOfDays: 1,
            multiplyByDays: true,
            serviceCharge: 0,
            transportCosts: 0,
            vatType: 'inclusive',
            selectedEventType: eventTypes[0],
            customEventType: '',
            startDate: undefined,
            endDate: undefined,
            serviceFields: {
                eventType: true, mealType: true, pax: true,
                numberOfDays: true, startDate: true, endDate: true, location: true
            },
            serviceDesc: '',
            items: [{
                id: '1', eventType: eventTypes[0], customEventType: '', mealType: '',
                pax: 0, unitPrice: 0, total: 0, date: undefined, particularType: 'event'
            }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    const watchItems = form.watch('items');
    const watchStartDate = form.watch('startDate');
    const watchEndDate = form.watch('endDate');

    useEffect(() => {
        if (isEditMode && invoiceId) {
            const existingInvoice = getInvoiceById(invoiceId);
            if (existingInvoice) {
                form.reset({
                    ...existingInvoice,
                    invoiceDate: existingInvoice.invoiceDate || new Date().toISOString(),
                });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Invoice not found.' });
                router.push('/invoices');
            }
        }
    }, [isEditMode, invoiceId, getInvoiceById, form, router, toast]);

    useEffect(() => {
        if (watchStartDate && watchEndDate) {
            const start = parseISO(watchStartDate);
            const end = parseISO(watchEndDate);
            if (isValid(start) && isValid(end)) {
                const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                form.setValue('numberOfDays', diff);
            }
        }
    }, [watchStartDate, watchEndDate, form]);

    useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (name?.startsWith('items')) {
                const items = form.getValues('items');
                items.forEach((item, index) => {
                    const newTotal = (item.pax || 0) * (item.unitPrice || 0);
                    if (item.total !== newTotal) {
                        form.setValue(`items.${index}.total`, newTotal, { shouldValidate: true });
                    }
                });
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);

    async function handleSave(data: InvoiceFormData) {
        setIsSubmitting(true);
        try {
            if (isEditMode && invoiceId) {
                updateInvoice(invoiceId, data);
                toast({ title: 'Success', description: 'Invoice updated successfully.' });
            } else {
                addInvoice(data);
                toast({ title: 'Success', description: 'Invoice created successfully.' });
            }
            router.push('/invoices');
        } catch (error) {
            console.error("Failed to save invoice", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save invoice.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (showPreview) {
        const formData = form.getValues();
        const selectedClient = clients.find(c => c.id === formData.clientId);
        return (
            <InvoicePreview
              formData={formData}
              client={selectedClient}
              onDismiss={() => setShowPreview(false)}
              onSave={() => form.handleSubmit(handleSave)()}
              isSaving={isSubmitting}
            />
        );
    }

    return (
        <Card className="max-w-5xl mx-auto">
            <CardHeader>
                <CardTitle className="text-3xl font-bold text-primary">{isEditMode ? "Edit Proforma Invoice" : "Proforma Invoice Generator"}</CardTitle>
                <CardDescription>Fill in the details below to create a new proforma invoice.</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={form.handleSubmit(() => setShowPreview(true))} className="space-y-8">

                {/* Invoice Details Section */}
                <Card className="p-6">
                    <CardTitle className="text-xl mb-4">Invoice Details</CardTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller name="invoiceDate" control={form.control} render={({ field }) => (
                            <div><Label>Invoice Date</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                    </Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d?.toISOString())} /></PopoverContent>
                                </Popover>
                            </div>
                        )}/>
                        <Controller name="id" control={form.control} render={({ field }) => (
                            <div><Label>Invoice Number</Label><Input {...field} placeholder="e.g., PI-2024-001" /></div>
                        )}/>
                    </div>
                </Card>

                {/* Client Info Section */}
                <Card className="p-6">
                  <CardTitle className="text-xl mb-4">Client Information</CardTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller name="clientId" control={form.control} render={({ field }) => (
                        <div><Label>Select Client</Label>
                            <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={clientsLoading}>
                            <SelectTrigger><SelectValue placeholder={clientsLoading ? "Loading..." : "Select a client"} /></SelectTrigger>
                            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}/>
                    <Controller name="lpoNumber" control={form.control} render={({ field }) => (
                        <div><Label>LPO Number</Label><Input {...field} placeholder="Enter LPO number" /></div>
                    )}/>
                    <Controller name="receiverName" control={form.control} render={({ field }) => (
                        <div><Label>Receiver Name</Label><Input {...field} placeholder="Enter receiver name" /></div>
                    )}/>
                    <Controller name="receiverPosition" control={form.control} render={({ field }) => (
                        <div><Label>Receiver Position</Label><Input {...field} placeholder="Enter receiver position" /></div>
                    )}/>
                  </div>
                </Card>

                {/* Event Details Section */}
                <Card className="p-6">
                    <CardTitle className="text-xl mb-4">Event Details</CardTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <Controller name="startDate" control={form.control} render={({ field }) => (
                            <div><Label>Start Date</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick start date</span>}
                                    </Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d?.toISOString())} /></PopoverContent>
                                </Popover>
                            </div>
                        )}/>
                        <Controller name="endDate" control={form.control} render={({ field }) => (
                            <div><Label>End Date</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick end date</span>}
                                    </Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d?.toISOString())} /></PopoverContent>
                                </Popover>
                            </div>
                        )}/>
                        <Controller name="location" control={form.control} render={({ field }) => (
                            <div><Label>Location</Label><Input {...field} placeholder="Enter event location" /></div>
                        )}/>
                        <Controller name="numberOfDays" control={form.control} render={({ field }) => (
                             <div><Label>Number of Days</Label><Input type="number" min="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} /></div>
                        )}/>
                        <Controller name="multiplyByDays" control={form.control} render={({ field }) => (
                            <div className="flex items-center space-x-2 mt-2 pt-6">
                                <Checkbox id="multiply-days" checked={field.value} onCheckedChange={field.onChange} />
                                <Label htmlFor="multiply-days">Multiply subtotal by number of days</Label>
                            </div>
                        )}/>
                    </div>
                </Card>

                {/* Service Description Customization */}
                <Card className="p-6">
                    <CardTitle className="text-xl mb-4">Service Description</CardTitle>
                    <div className="space-y-4">
                        <div><Label>Event Type for Description</Label>
                            <Controller name="selectedEventType" control={form.control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{eventTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                            )}/>
                            {form.watch('selectedEventType') === 'Custom' && <Controller name="customEventType" control={form.control} render={({ field }) => (
                                <Input {...field} placeholder="Custom Event Type" className="mt-2" />
                            )}/>}
                        </div>
                        <div><Label className="block">Customize Service Description Fields</Label>
                        <div className="flex flex-wrap gap-4 mt-2">
                        {serviceFieldsList.map(item => (
                            <div key={item.key} className="flex items-center space-x-2">
                                <Controller name={`serviceFields.${item.key}`} control={form.control} render={({ field }) => (
                                    <Checkbox id={`sf-${item.key}`} checked={field.value} onCheckedChange={field.onChange} />
                                )}/>
                                <Label htmlFor={`sf-${item.key}`}>{item.label}</Label>
                            </div>
                        ))}
                        </div></div>
                        <div><Label className="block">Service Description Text</Label>
                            <Controller name="serviceDesc" control={form.control} render={({ field }) => (
                                <textarea className="w-full border rounded p-2 mt-1 bg-background" rows={3} {...field} />
                            )}/>
                        </div>
                    </div>
                </Card>

                {/* Invoice Items Section */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-primary">Invoice Items</h3>
                        <Button type="button" onClick={() => append({ id: Date.now().toString(), eventType: eventTypes[0], customEventType: '', mealType: '', pax: 0, unitPrice: 0, total: 0, date: undefined, particularType: 'event' })} size="sm">
                            <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                    </div>
                    <div className="space-y-6">
                        {fields.map((item, index) => (
                            <Card key={item.id} className="p-6 border-l-4 border-primary">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-lg font-semibold text-primary">Item #{index + 1}</h4>
                                    <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                    <div><Label>Show in Particulars</Label>
                                        <Controller name={`items.${index}.particularType`} control={form.control} render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent><SelectItem value="event">Event Type</SelectItem><SelectItem value="meal">Meal Type</SelectItem></SelectContent>
                                            </Select>
                                        )}/>
                                    </div>
                                    <div><Label>Event Type</Label>
                                        <Controller name={`items.${index}.eventType`} control={form.control} render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>{eventTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )}/>
                                        {form.watch(`items.${index}.eventType`) === 'Custom' && <Controller name={`items.${index}.customEventType`} control={form.control} render={({ field }) => (
                                            <Input {...field} placeholder="Custom Event" className="mt-2"/>
                                        )}/>}
                                    </div>
                                     <div><Label>Meal Type</Label>
                                        <Controller name={`items.${index}.mealType`} control={form.control} render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>{mealTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )}/>
                                    </div>
                                    <div><Label>Date</Label>
                                        <Controller name={`items.${index}.date`} control={form.control} render={({ field }) => (
                                            <Popover><PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick date</span>}
                                                </Button></PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value): undefined} onSelect={d=>field.onChange(d?.toISOString())} /></PopoverContent>
                                            </Popover>
                                        )}/>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <div><Label>Pax</Label><Controller name={`items.${index}.pax`} control={form.control} render={({ field }) => (<Input type="number" min="0" {...field} onChange={e=>field.onChange(parseInt(e.target.value) || 0)} />)} /></div>
                                     <div><Label>Unit Price (TSHS)</Label><Controller name={`items.${index}.unitPrice`} control={form.control} render={({ field }) => (<Input type="number" min="0" step="0.01" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)} />)} /></div>
                                     <div><Label>Total (TSHS)</Label><Controller name={`items.${index}.total`} control={form.control} render={({ field }) => (<Input type="number" {...field} readOnly className="bg-muted" />)} /></div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </Card>
                
                {/* Additional Charges Section */}
                <Card className="p-6">
                    <CardTitle className="text-xl mb-4">Additional Charges</CardTitle>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div><Label>Service Charge (TSHS)</Label><Controller name="serviceCharge" control={form.control} render={({ field }) => (<Input type="number" min="0" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/>)} /></div>
                         <div><Label>Transport Costs (TSHS)</Label><Controller name="transportCosts" control={form.control} render={({ field }) => (<Input type="number" min="0" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/>)} /></div>
                         <div><Label>VAT Type</Label><Controller name="vatType" control={form.control} render={({ field }) => (
                             <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                             <SelectContent><SelectItem value="inclusive">Inclusive (0%)</SelectItem><SelectItem value="exclusive">Exclusive (+18%)</SelectItem></SelectContent>
                             </Select>
                         )}/></div>
                    </div>
                </Card>

                <div className="mt-8 flex justify-end gap-4">
                    <Button type="submit" size="lg">
                        <Eye className="w-5 h-5 mr-2" /> Preview Invoice
                    </Button>
                </div>
            </form>
            </CardContent>
        </Card>
    );
}

