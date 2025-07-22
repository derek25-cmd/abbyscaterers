
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, Loader2, Save, Eye } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useProformaInvoiceStorage } from '@/hooks/use-proforma-invoice-storage';
import { useInvoiceStorage } from '@/hooks/use-invoice-storage';
import { FinalInvoiceSchema, type FinalInvoiceFormData } from '@/lib/schemas';
import { InvoiceTemplate } from './invoice-template';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';


interface InvoiceFormProps {
    invoiceId?: string;
    proformaId?: string;
}

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

export function InvoiceForm({ invoiceId, proformaId }: InvoiceFormProps) {
    const router = useRouter();
    const { clients, isLoading: clientsLoading } = useClientStorage();
    const { getProformaById } = useProformaInvoiceStorage();
    const { getInvoiceById, addInvoice, updateInvoice } = useInvoiceStorage();
    const { toast } = useToast();

    const isEditMode = !!invoiceId;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const form = useForm<FinalInvoiceFormData>({
        resolver: zodResolver(FinalInvoiceSchema),
        defaultValues: {
            id: "",
            proformaId: proformaId,
            status: 'outstanding',
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
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            serviceFields: Object.fromEntries(serviceFieldsList.map(f => [f.key, true])),
            serviceDesc: '',
            items: [{ id: '1', particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: new Date().toISOString() }],
            signedAtDate: new Date().toISOString(),
            signedAtLocation: 'Dar es Salaam'
        }
    });
    
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    const watchedItems = form.watch("items");
    const watchedStartDate = form.watch("startDate");
    const watchedEndDate = form.watch("endDate");
    const watchedServiceFields = form.watch("serviceFields");
    const watchedLocation = form.watch("location");
    const watchedSelectedEventType = form.watch("selectedEventType");
    const watchedCustomEventType = form.watch("customEventType");

     const buildServiceDesc = () => {
        const { serviceFields, items, numberOfDays, startDate, endDate, location, selectedEventType, customEventType } = form.getValues();
        let desc = 'Provision of';
        if (serviceFields.eventType && (selectedEventType || customEventType)) {
            desc += ` ${selectedEventType === 'Custom' ? customEventType : selectedEventType}`;
        }
        if (serviceFields.mealType && items[0]?.mealType) desc += ` ${items[0].mealType}`;
        const totalPax = items.reduce((sum, item) => sum + (item.pax || 0), 0)
        if (serviceFields.pax) desc += ` to ${totalPax || '{pax}'}`;
        if (serviceFields.numberOfDays) desc += ` # day for ${numberOfDays || '{No. of days}'}`;
        if (serviceFields.startDate && startDate) desc += ` from ${format(parseISO(startDate), 'dd/MM/yyyy')}`;
        if (serviceFields.endDate && endDate) desc += ` to ${format(parseISO(endDate), 'dd/MM/yyyy')}`;
        if (serviceFields.location && location) desc += ` at ${location}`;
        return desc;
    };
    
    useEffect(() => {
        form.setValue("serviceDesc", buildServiceDesc());
    }, [watchedServiceFields, watchedItems, form.watch("numberOfDays"), watchedStartDate, watchedEndDate, watchedLocation, watchedSelectedEventType, watchedCustomEventType]);


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
             if (name === 'startDate' || name === 'endDate') {
                const { startDate, endDate } = form.getValues();
                if (startDate && endDate) {
                    const diff = Math.max(1, Math.ceil((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                    form.setValue('numberOfDays', diff);
                } else {
                    form.setValue('numberOfDays', 1);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);

    useEffect(() => {
        if (isEditMode && invoiceId) {
            const existingInvoice = getInvoiceById(invoiceId);
            if (existingInvoice) form.reset(existingInvoice);
        } else if (proformaId) {
            const proforma = getProformaById(proformaId);
            if (proforma) {
                form.reset({
                    ...proforma, // Spread proforma data
                    proformaId: proforma.id,
                    id: '', // Clear final invoice ID
                    status: 'outstanding',
                    invoiceDate: new Date().toISOString(), // Set new date for final invoice
                    // map proforma items to final invoice items
                    items: proforma.items.map(pi => ({
                        id: pi.id,
                        particularType: pi.particularType,
                        eventType: pi.eventType,
                        customEventType: pi.customEventType,
                        mealType: pi.mealType,
                        pax: pi.pax,
                        unitPrice: pi.unitPrice,
                        total: pi.total,
                        date: pi.date,
                        particularDescription: pi.particularDescription
                    })),
                    signedAtDate: new Date().toISOString(),
                    signedAtLocation: 'Dar es Salaam'
                });
            }
        }
    }, [isEditMode, invoiceId, proformaId, getInvoiceById, getProformaById, form]);

    async function handleSave(data: FinalInvoiceFormData) {
        setIsSubmitting(true);
        try {
            if (isEditMode && invoiceId) {
                updateInvoice(invoiceId, data);
                toast({ title: 'Success', description: 'Invoice updated successfully.' });
                router.push(`/invoices/${data.id}`);
            } else {
                const newInvoice = addInvoice(data);
                toast({ title: 'Success', description: 'Invoice created successfully.' });
                router.push(`/invoices/${newInvoice.id}`);
            }
        } catch (error) {
            console.error("Failed to save invoice", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save invoice.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const calculateSubtotal = () => form.getValues('items').reduce((sum, item) => sum + item.total, 0);
    const calculateTotalDays = () => form.getValues('multiplyByDays') ? calculateSubtotal() * (form.getValues('numberOfDays') || 1) : calculateSubtotal();
    const calculateVAT = () => {
        const total = calculateTotalDays() + form.getValues('serviceCharge') + form.getValues('transportCosts');
        return form.getValues('vatType') === 'exclusive' ? total * 0.18 : 0;
    };
    const calculateGrandTotal = () => calculateTotalDays() + form.getValues('serviceCharge') + form.getValues('transportCosts') + calculateVAT();

    if (showPreview) {
        const formData = form.getValues();
        const selectedClient = clients.find(c => c.id === formData.clientId);
        return (
            <div>
                 <div className="flex justify-end gap-4 mb-4">
                    <Button type="button" variant="outline" onClick={() => setShowPreview(false)}>Back to Edit</Button>
                    <Button type="button" onClick={() => form.handleSubmit(handleSave)()} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                        {isEditMode ? 'Update Invoice' : 'Save Invoice'}
                    </Button>
                </div>
                <InvoiceTemplate invoiceData={formData} client={selectedClient} />
            </div>
        )
    }

    return (
        <Card className="max-w-5xl mx-auto">
            <CardHeader>
                <CardTitle className="text-3xl font-bold text-primary">{isEditMode ? "Edit Invoice" : "Create New Invoice"}</CardTitle>
                <CardDescription>{proformaId ? `Creating invoice from Proforma #${proformaId}` : "Fill in the details for the final invoice."}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(() => setShowPreview(true))} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller name="id" control={form.control} render={({ field }) => (
                            <div><Label>Invoice Number</Label><Input {...field} placeholder="e.g., INV-2024-001" /></div>
                        )}/>
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
                         <Controller name="clientId" control={form.control} render={({ field }) => (
                            <div><Label>Select Client</Label>
                                <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={clientsLoading}>
                                <SelectTrigger><SelectValue placeholder={clientsLoading ? "Loading..." : "Select a client"} /></SelectTrigger>
                                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}/>
                         <Controller name="status" control={form.control} render={({ field }) => (
                            <div><Label>Status</Label>
                                <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="outstanding">Outstanding</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
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
                        <Controller name="startDate" control={form.control} render={({ field }) => (
                            <div><Label>Start Date</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
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
                                    {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                    </Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d?.toISOString())} /></PopoverContent>
                                </Popover>
                            </div>
                        )}/>
                         <Controller name="location" control={form.control} render={({ field }) => (
                            <div><Label>Location</Label><Input {...field} placeholder="Enter event location" /></div>
                        )}/>
                        <Controller name="numberOfDays" control={form.control} render={({ field }) => (
                            <div><Label>Number of Days</Label><Input type="number" min="1" {...field} onChange={e=>field.onChange(parseInt(e.target.value) || 1)} /></div>
                        )}/>
                        <Controller name="multiplyByDays" control={form.control} render={({ field }) => (
                             <div className="flex items-center space-x-2 pt-6">
                                <Checkbox id="multiply-days" checked={field.value} onCheckedChange={field.onChange} />
                                <Label htmlFor="multiply-days">Multiply subtotal by number of days</Label>
                            </div>
                        )}/>
                    </div>

                    <div className="mt-8 mb-6">
                        <Label>Event Type for Service Description</Label>
                         <Controller name="selectedEventType" control={form.control} render={({ field }) => (
                             <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{eventTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                             </Select>
                         )}/>
                        {form.watch("selectedEventType") === 'Custom' && (
                             <Controller name="customEventType" control={form.control} render={({ field }) => (
                                <Input {...field} placeholder="Custom Event Type" className="mt-2" />
                            )}/>
                        )}

                        <Label className="mt-4 block">Customize Service Description Fields</Label>
                        <div className="flex flex-wrap gap-4 mt-2">
                          {serviceFieldsList.map(field => (
                            <div key={field.key} className="flex items-center space-x-2">
                                <Controller name={`serviceFields.${field.key}`} control={form.control} render={({ field: checkboxField }) => (
                                     <Checkbox
                                        checked={checkboxField.value}
                                        onCheckedChange={checkboxField.onChange}
                                        id={`service-field-${field.key}`}
                                      />
                                )}/>
                              <Label htmlFor={`service-field-${field.key}`}>{field.label}</Label>
                            </div>
                          ))}
                        </div>
                        <Label className="mt-4 block">Service Description</Label>
                         <Controller name="serviceDesc" control={form.control} render={({ field }) => (
                            <Textarea {...field} rows={3} />
                        )}/>
                    </div>

                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-primary">Invoice Items</h3>
                            <Button type="button" onClick={() => append({ id: Date.now().toString(), particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: new Date().toISOString() })} size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Add Item
                            </Button>
                        </div>
                        <div className="space-y-4">
                        {fields.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-11 gap-2 items-end p-2 border rounded-md relative">
                                <div className="md:col-span-2">
                                    <Label>Particulars</Label>
                                    <Controller name={`items.${index}.particularType`} control={form.control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent><SelectItem value="event">Event</SelectItem><SelectItem value="meal">Meal</SelectItem></SelectContent>
                                        </Select>
                                    )}/>
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Event Type</Label>
                                    <Controller name={`items.${index}.eventType`} control={form.control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>{eventTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )}/>
                                </div>
                                 <div className="md:col-span-2">
                                    <Label>Meal Type</Label>
                                    <Controller name={`items.${index}.mealType`} control={form.control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>{mealTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )}/>
                                </div>
                                <div><Label>Pax</Label><Controller name={`items.${index}.pax`} control={form.control} render={({ field }) => <Input type="number" {...field} onChange={e=>field.onChange(parseInt(e.target.value) || 0)} />} /></div>
                                <div className="md:col-span-2"><Label>Unit Price</Label><Controller name={`items.${index}.unitPrice`} control={form.control} render={({ field }) => <Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)} />} /></div>
                                <div><Label>Total</Label><Controller name={`items.${index}.total`} control={form.control} render={({ field }) => <Input type="number" {...field} readOnly />} /></div>
                                <div className="absolute top-1 right-1">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                </div>
                            </div>
                        ))}
                        </div>
                    </Card>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <Controller name="serviceCharge" control={form.control} render={({ field }) => (
                             <div><Label>Service Charge (TSHS)</Label><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/></div>
                        )}/>
                        <Controller name="transportCosts" control={form.control} render={({ field }) => (
                             <div><Label>Transport Costs (TSHS)</Label><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/></div>
                        )}/>
                        <Controller name="vatType" control={form.control} render={({ field }) => (
                             <div><Label>VAT Type</Label>
                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="inclusive">Inclusive</SelectItem><SelectItem value="exclusive">Exclusive (+18%)</SelectItem></SelectContent>
                                </Select>
                             </div>
                         )}/>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <Controller name="signedAtLocation" control={form.control} render={({ field }) => (
                            <div><Label>Signed At Location</Label><Input {...field} /></div>
                        )}/>
                        <Controller name="signedAtDate" control={form.control} render={({ field }) => (
                            <div><Label>Signed At Date</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                    </Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d?.toISOString())} /></PopoverContent>
                                </Popover>
                            </div>
                        )}/>
                    </div>

                     <div className="mt-8 p-4 bg-secondary/20 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">Summary</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>{calculateSubtotal().toLocaleString()} TSHS</span>
                            </div>
                            {form.getValues('multiplyByDays') && (
                              <div className="flex justify-between">
                                <span>Subtotal × No of Days:</span>
                                <span>{calculateTotalDays().toLocaleString()} TSHS</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Service Charge:</span>
                              <span>{form.getValues('serviceCharge').toLocaleString()} TSHS</span>
                            </div>
                             <div className="flex justify-between">
                                <span>Transport Costs:</span>
                                <span>{form.getValues('transportCosts').toLocaleString()} TSHS</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>VAT ({form.getValues('vatType') === 'exclusive' ? '18%' : '0%'}):</span>
                              <span>{calculateVAT().toLocaleString()} TSHS</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg border-t pt-2">
                              <span>Grand Total:</span>
                              <span className="text-accent">{calculateGrandTotal().toLocaleString()} TSHS</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Eye className="w-5 h-5 mr-2" />}
                            Preview Invoice
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
