
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
import { CalendarIcon, Plus, Trash2, Loader2, Save, ChevronsUpDown, Check, Settings2, User, Info, FileText, CheckCircle, Building } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useProformaInvoiceStorage } from '@/hooks/use-proforma-invoice-storage';
import { useInvoiceStorage } from '@/hooks/use-invoice-storage';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { FinalInvoiceSchema, type FinalInvoiceFormData } from '@/lib/schemas';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useBookingStorage } from '@/hooks/use-booking-storage';

interface InvoiceFormProps {
    invoiceId?: string;
    proformaId?: string;
    clientId?: string;
    bookingId?: string;
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
  'Brunch',
  'Breakfast, lunch and evening tea',
  'Breakfast, lunch and dinner',
  'Evening tea',
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

export function InvoiceForm({ invoiceId, proformaId, clientId, bookingId }: InvoiceFormProps) {
    const router = useRouter();
    const { clients, getClientById: getClientDetails, isLoading: clientsLoading } = useClientStorage();
    const { getProformaById } = useProformaInvoiceStorage();
    const { getInvoiceById, addInvoice, updateInvoice } = useInvoiceStorage();
    const { orders, addOrder, updateOrder, getOrderById, getOrdersByBookingId } = useOrderStorage();
    const { getBookingById } = useBookingStorage();
    const { toast } = useToast();

    const isEditMode = !!invoiceId;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(['item-0']);
    const DRAFT_STORAGE_KEY = isEditMode ? `final-invoice-draft-${invoiceId}` : 'final-invoice-draft-new';

    const form = useForm<FinalInvoiceFormData>({
        resolver: zodResolver(FinalInvoiceSchema),
        defaultValues: {
            id: `INV-${Date.now()}`,
            proformaId: proformaId,
            status: 'outstanding',
            invoiceDate: new Date().toISOString(),
            clientId: clientId || null,
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
            items: [{ id: `ORD-${Date.now()}`, particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: new Date().toISOString(), vatType: 'inclusive' }],
            signedAtDate: new Date().toISOString(),
            signedAtLocation: 'Dar es Salaam'
        }
    });
    
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    
    const watchedFormValues = form.watch();
    const selectedClientId = form.watch('clientId');
    const selectedClient = selectedClientId ? getClientDetails(selectedClientId) : undefined;

    const handleSaveAndCreateOrder = (itemIndex: number) => {
        const itemData = form.getValues(`items.${itemIndex}`);
        const client_id = form.getValues('clientId');
        const proformaId = form.getValues('proformaId');

        if (!client_id) {
            toast({ variant: "destructive", title: "Client Not Selected", description: "Please select a client before creating or updating an order." });
            return;
        }

        try {
            const existingOrder = getOrderById(itemData.id!);
            
            const recalculatedTotal = (itemData.pax || 0) * (itemData.unitPrice || 0);

            const orderPayload = {
                id: itemData.id,
                name: `Order for ${itemData.eventType} on ${itemData.date ? format(parseISO(itemData.date), 'PPP') : 'a future date'}`,
                description: `Order related to proforma ${proformaId || 'N/A'}`,
                proformaId: proformaId || "",
                clientEvents: [{
                    clientId: client_id,
                    date: itemData.date || new Date().toISOString(),
                    numberOfPeople: itemData.pax,
                    mealType: itemData.mealType,
                    unitPrice: itemData.unitPrice,
                    total: recalculatedTotal,
                    vatType: itemData.vatType,
                    recipes: existingOrder?.clientEvents?.[0]?.recipes || [],
                }],
            };

            if (existingOrder) {
                updateOrder(itemData.id!, orderPayload as any);
                toast({ title: "Order Updated", description: `Order ${itemData.id} has been successfully updated.` });
            } else {
                addOrder(orderPayload as any); 
                toast({ title: "Order Created", description: `Order ${itemData.id} has been saved.` });
            }
            setOpenAccordionItems(prev => prev.filter(p => p !== `item-${itemIndex}`));
        } catch (error) {
            console.error("Failed to create/update order:", error);
            let message = "An error occurred while saving the order.";
            if (error instanceof Error) message = error.message;
            toast({ variant: "destructive", title: "Failed to Save Order", description: message });
        }
    };


     const buildServiceDesc = React.useCallback(() => {
        const { serviceFields, items, numberOfDays, startDate, endDate, location, selectedEventType, customEventType } = form.getValues();
        let desc = 'Provision of';
        if (serviceFields.eventType && (selectedEventType || customEventType)) {
            desc += ` ${selectedEventType === 'Custom' ? customEventType : selectedEventType}`;
        }
        if (serviceFields.mealType && items[0]?.mealType) desc += ` ${items[0].mealType}`;
        const totalPax = items.reduce((sum, item) => sum + (item.pax || 0), 0)
        if (serviceFields.pax && totalPax > 0) desc += ` to ${totalPax}`;
        if (serviceFields.numberOfDays) desc += ` for ${numberOfDays || '{No. of days}'} day(s)`;
        if (serviceFields.startDate && startDate && isValid(parseISO(startDate))) desc += ` from ${format(parseISO(startDate), 'dd/MM/yyyy')}`;
        if (serviceFields.endDate && endDate && isValid(parseISO(endDate))) desc += ` to ${format(parseISO(endDate), 'dd/MM/yyyy')}`;
        if (serviceFields.location && location) desc += ` at ${location}`;
        return desc;
    }, [form]);
    
    useEffect(() => {
        form.setValue("serviceDesc", buildServiceDesc());
    }, [watchedFormValues.serviceFields, watchedFormValues.items, watchedFormValues.numberOfDays, watchedFormValues.startDate, watchedFormValues.endDate, watchedFormValues.location, watchedFormValues.selectedEventType, watchedFormValues.customEventType, buildServiceDesc, form]);


    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(value));

            if (name?.startsWith('items.')) {
                const items = form.getValues('items');
                const parts = name.split('.');
                 if(parts.length > 2) {
                    const index = parseInt(parts[1], 10);
                    const fieldName = parts[2];
                    const item = items[index];

                    if (fieldName === 'pax' || fieldName === 'unitPrice') {
                        const newTotal = (item.pax || 0) * (item.unitPrice || 0);
                         if (item.total !== newTotal) {
                             form.setValue(`items.${index}.total`, newTotal, { shouldValidate: true });
                         }
                    }
                    
                    if (fieldName === 'particularType' || fieldName === 'eventType' || fieldName === 'mealType' || fieldName === 'date') {
                        if (item.particularType === 'event') {
                            form.setValue(`items.${index}.particularDescription`, `${item.eventType} on ${item.date ? format(parseISO(item.date), 'PPP') : ''}`)
                        } else {
                            form.setValue(`items.${index}.particularDescription`, `${item.mealType} on ${item.date ? format(parseISO(item.date), 'PPP') : ''}`)
                        }
                    }
                }
            }
             if (name === 'startDate' || name === 'endDate') {
                const { startDate, endDate } = form.getValues();
                if (startDate && endDate && isValid(parseISO(startDate)) && isValid(parseISO(endDate))) {
                    const diff = Math.max(1, Math.ceil((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                    form.setValue('numberOfDays', diff);
                } else {
                    form.setValue('numberOfDays', 1);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form, DRAFT_STORAGE_KEY]);

    useEffect(() => {
        let dataToLoad: Partial<FinalInvoiceFormData> | undefined;

        if (isEditMode && invoiceId) {
            dataToLoad = getInvoiceById(invoiceId);
        } else if (proformaId) {
            const proforma = getProformaById(proformaId);
            if (proforma) {
                dataToLoad = {
                    ...proforma,
                    proformaId: proforma.id,
                    id: `INV-${Date.now()}`,
                    status: 'outstanding',
                    invoiceDate: new Date().toISOString(),
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
                        particularDescription: pi.particularDescription,
                        vatType: pi.vatType,
                    })),
                    signedAtDate: new Date().toISOString(),
                    signedAtLocation: 'Dar es Salaam'
                };
            }
        } else if (bookingId) {
            const booking = getBookingById(bookingId);
            const bookingOrders = getOrdersByBookingId(bookingId);
            if (booking && bookingOrders.length > 0) {
                 dataToLoad = {
                    id: `INV-${Date.now()}`,
                    proformaId: '',
                    status: 'outstanding',
                    invoiceDate: new Date().toISOString(),
                    clientId: booking.client_id,
                    location: '',
                    numberOfDays: bookingOrders.length,
                    multiplyByDays: false,
                    serviceCharge: 0,
                    transportCosts: 0,
                    vatType: 'inclusive',
                    startDate: booking.start_date,
                    endDate: booking.end_date,
                    serviceFields: Object.fromEntries(serviceFieldsList.map(f => [f.key, true])),
                    items: bookingOrders.flatMap(order => order.clientEvents.map(event => ({
                        id: order.id,
                        particularType: 'meal' as const,
                        eventType: '',
                        mealType: event.mealType,
                        pax: event.numberOfPeople,
                        unitPrice: event.unitPrice,
                        total: event.unitPrice * event.numberOfPeople,
                        date: event.date,
                        vatType: event.vatType,
                        particularDescription: `${event.mealType} on ${format(parseISO(event.date), 'PPP')}`
                    }))),
                    signedAtDate: new Date().toISOString(),
                    signedAtLocation: 'Dar es Salaam'
                 };
            }
        } else {
            const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (savedDraft) {
                try {
                    dataToLoad = JSON.parse(savedDraft);
                    toast({ title: 'Draft Restored', description: 'Your unsaved changes have been loaded.' });
                } catch (e) {
                    console.error("Failed to parse draft from localStorage", e);
                }
            }
        }

        if (dataToLoad) {
            form.reset(dataToLoad);
        }

    }, [isEditMode, invoiceId, proformaId, bookingId, getInvoiceById, getProformaById, getBookingById, getOrdersByBookingId, form, DRAFT_STORAGE_KEY, toast]);

    async function onSubmit(data: FinalInvoiceFormData) {
        setIsSubmitting(true);
        try {
            if (isEditMode && invoiceId) {
                await updateInvoice(invoiceId, data);
                toast({ title: 'Success', description: 'Invoice updated successfully.' });
                localStorage.removeItem(DRAFT_STORAGE_KEY);
                router.push(`/invoices/${invoiceId}`);
            } else {
                const newInvoice = await addInvoice(data);
                if (newInvoice) {
                    toast({ title: 'Success', description: 'Invoice created successfully.' });
                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                    router.push(`/invoices/${newInvoice.id}`);
                } else {
                     toast({ variant: 'destructive', title: 'Error', description: 'Failed to create invoice.' });
                }
            }
        } catch (error) {
            console.error("Failed to save invoice", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save invoice.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const calculateSubtotal = () => form.getValues('items').reduce((sum, item) => sum + (item.total || 0), 0);
    const calculateTotalDays = () => form.getValues('multiplyByDays') ? calculateSubtotal() * (form.getValues('numberOfDays') || 1) : calculateSubtotal();
    const calculateVAT = () => {
        const total = calculateTotalDays() + (form.getValues('serviceCharge') || 0) + (form.getValues('transportCosts') || 0);
        return form.getValues('vatType') === 'exclusive' ? total * 0.18 : 0;
    };
    const calculateGrandTotal = () => calculateTotalDays() + (form.getValues('serviceCharge') || 0) + (form.getValues('transportCosts') || 0) + calculateVAT();

    return (
        <Card className="max-w-5xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-3xl font-bold text-primary">{isEditMode ? "Edit Invoice" : "Create New Invoice"}</CardTitle>
                        <CardDescription>{proformaId ? `Creating invoice from Proforma #${proformaId}` : "Fill in the details for the final invoice."}</CardDescription>
                    </div>
                    {selectedClient && (
                         <div className="text-right p-2 rounded-md bg-muted/50 border">
                            <p className="text-sm text-muted-foreground">Client</p>
                            <p className="text-lg font-bold text-primary flex items-center gap-2"><Building className="h-5 w-5" />{selectedClient.companyName}</p>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
                       <AccordionItem value="item-1">
                        <AccordionTrigger className="text-lg font-semibold"><Info className="mr-2 h-5 w-5 text-primary" />Invoice Details</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
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
                            </div>
                        </AccordionContent>
                      </AccordionItem>
                      
                       <AccordionItem value="item-2">
                        <AccordionTrigger className="text-lg font-semibold"><User className="mr-2 h-5 w-5 text-primary" />Client Information</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Controller name="clientId" control={form.control} render={({ field }) => (
                                <div><Label>Select Client</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={clientsLoading || !!clientId}>
                                            {clientsLoading ? "Loading..." : field.value ? clients.find(c => c.id === field.value)?.companyName : "Select client"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search client..." />
                                            <CommandList><CommandEmpty>No client found.</CommandEmpty>
                                            <CommandGroup>
                                                {clients.map((c) => (
                                                    <CommandItem key={c.id} value={c.companyName} onSelect={() => { field.onChange(c.id)}}>
                                                        <Check className={cn("mr-2 h-4 w-4", c.id === field.value ? "opacity-100" : "opacity-0")} />
                                                        {c.companyName}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
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
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="item-3">
                        <AccordionTrigger className="text-lg font-semibold"><Settings2 className="mr-2 h-5 w-5 text-primary" />Service Customization</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            </div>
                            <div className="mt-4 space-y-2">
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
                                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
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
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    
                    <Card className="p-4 border-primary/20">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-primary flex items-center"><FileText className="mr-2 h-5 w-5"/>Invoice Items</h3>
                            <Button type="button" onClick={() => { 
                                const newIndex = fields.length;
                                append({ id: `ORD-${Date.now()}`, particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: new Date().toISOString(), vatType: 'inclusive' });
                                setOpenAccordionItems([`item-${newIndex}`]);
                             }} size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Add Item
                            </Button>
                        </div>
                        <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-2">
                            {fields.map((item, index) => {
                                const orderId = form.getValues(`items.${index}.id`);
                                const isSaved = orderId ? orders.some(o => o.id === orderId) : false;
                                return (
                                <AccordionItem key={item.id} value={`item-${index}`} className="border-b-0 rounded-md bg-card/60">
                                    <AccordionTrigger className="p-2 hover:no-underline rounded-md data-[state=open]:bg-primary/10">
                                        <div className="flex items-center gap-2">
                                            {isSaved && <CheckCircle className="h-5 w-5 text-green-500"/>}
                                            <span className="font-semibold">Order Item #{index + 1}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{form.watch(`items.${index}.eventType`)}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 pt-2 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                            <div><Label>Order ID</Label><Controller name={`items.${index}.id`} control={form.control} render={({ field }) => <Input {...field} readOnly />} /></div>
                                            <div>
                                                <Label>Event Type</Label>
                                                <Controller name={`items.${index}.eventType`} control={form.control} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                                        <SelectContent>{eventTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )}/>
                                            </div>
                                            <div>
                                                <Label>Meal Type</Label>
                                                <Controller name={`items.${index}.mealType`} control={form.control} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                                        <SelectContent>{mealTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )}/>
                                            </div>
                                            <div>
                                            <Label>Event Date</Label>
                                            <Controller name={`items.${index}.date`} control={form.control} render={({ field }) => (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                                    </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d?.toISOString())} /></PopoverContent>
                                                </Popover>
                                            )} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                            <div><Label>No. of People</Label><Controller name={`items.${index}.pax`} control={form.control} render={({ field }) => <Input type="number" {...field} onChange={e=>field.onChange(parseInt(e.target.value) || 0)} />} /></div>
                                            <div><Label>Unit Price</Label><Controller name={`items.${index}.unitPrice`} control={form.control} render={({ field }) => <Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)} />} /></div>
                                            <div><Label>Total</Label><Controller name={`items.${index}.total`} control={form.control} render={({ field }) => <Input type="number" {...field} readOnly />} /></div>
                                            <div>
                                                <Label>VAT</Label>
                                                <Controller name={`items.${index}.vatType`} control={form.control} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="inclusive">Inclusive</SelectItem>
                                                            <SelectItem value="exclusive">Exclusive</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}/>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Particulars Display</Label>
                                            <Controller
                                                name={`items.${index}.particularType`}
                                                control={form.control}
                                                render={({ field }) => (
                                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 pt-2">
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="event" id={`event-${index}`} />
                                                            <Label htmlFor={`event-${index}`}>Event Type</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="meal" id={`meal-${index}`} />
                                                            <Label htmlFor={`meal-${index}`}>Meal Type</Label>
                                                        </div>
                                                    </RadioGroup>
                                                )}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t">
                                            <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}><Trash2 className="h-4 w-4 mr-2" />Remove</Button>
                                            <Button type="button" variant="outline" size="sm" onClick={() => handleSaveAndCreateOrder(index)}><Save className="h-4 w-4 mr-2" />{isSaved ? 'Update Order' : 'Save as Order'}</Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </Card>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <Controller name="serviceCharge" control={form.control} render={({ field }) => (
                             <div><Label>Service Charge (TSHS)</Label><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/></div>
                        )}/>
                        <Controller name="transportCosts" control={form.control} render={({ field }) => (
                             <div><Label>Transport Costs (TSHS)</Label><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/></div>
                        )}/>
                        <Controller name="vatType" control={form.control} render={({ field }) => (
                             <div><Label>VAT Type (Overall)</Label>
                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="inclusive">Inclusive</SelectItem><SelectItem value="exclusive">Exclusive (+18%)</SelectItem></SelectContent>
                                </Select>
                             </div>
                         )}/>
                    </div>
                     <div className="flex items-center space-x-2 pt-2">
                        <Controller name="multiplyByDays" control={form.control} render={({ field }) => (
                            <Checkbox id="multiply-days" checked={field.value} onCheckedChange={field.onChange} />
                        )}/>
                        <Label htmlFor="multiply-days">Multiply item totals by number of days</Label>
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

                     <div className="mt-6 p-4 bg-secondary/20 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">Summary</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                          
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Items Subtotal:</span>
                              <span className="font-medium">{calculateSubtotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} TSHS</span>
                            </div>
                            {form.getValues('multiplyByDays') && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total for {form.getValues('numberOfDays')} Day(s):</span>
                                <span className="font-medium">{calculateTotalDays().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} TSHS</span>
                              </div>
                            )}
                            <div className="flex justify-between col-start-1">
                              <span className="text-muted-foreground">Service Charge:</span>
                              <span className="font-medium">{form.getValues('serviceCharge').toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} TSHS</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Transport Costs:</span>
                                <span className="font-medium">{form.getValues('transportCosts').toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} TSHS</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t pt-2 mt-2 col-span-2">
                              <span>Total Before VAT:</span>
                              <span>{(calculateTotalDays() + form.getValues('serviceCharge') + form.getValues('transportCosts')).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} TSHS</span>
                            </div>
                            <div className="flex justify-between col-span-2">
                              <span className="text-muted-foreground">VAT ({form.getValues('vatType') === 'exclusive' ? '18%' : 'Inclusive'}):</span>
                              <span className="font-medium">{calculateVAT().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} TSHS</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg border-t-2 pt-2 mt-2 col-span-2">
                              <span className="text-primary">Grand Total:</span>
                              <span className="text-accent">{calculateGrandTotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} TSHS</span>
                            </div>
                          
                        </div>
                      </div>

                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                            {isEditMode ? 'Update Invoice' : 'Save and View Invoice'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
