
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, Loader2, Save, ChevronsUpDown, Check, Settings2, User, Info, FileText, CheckCircle, Building, Pencil, AlertCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useProformaInvoiceStorage } from '@/hooks/use-proforma-invoice-storage';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { ProformaInvoiceSchema, type ProformaInvoiceFormData } from '@/lib/schemas';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { REGIONS, type Order } from '@/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/hr/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ProformaInvoiceFormProps {
    invoiceId?: string;
    clientId?: string;
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

export function ProformaInvoiceForm({ invoiceId, clientId }: ProformaInvoiceFormProps) {
    const router = useRouter();
    const { clients, isLoading: clientsLoading } = useClientStorage();
    const { getProformaById, addProformaInvoice, updateProformaInvoice } = useProformaInvoiceStorage();
    const { orders, addOrder, updateOrder, getOrderById } = useOrderStorage();
    const { toast } = useToast();

    const isEditMode = !!invoiceId;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(['item-0']);
    
    // Logic for suggesting orders
    const [matchingOrders, setMatchingOrders] = useState<Order[]>([]);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedOrderIdsForImport, setSelectedOrderIdsForImport] = useState<string[]>([]);

    const form = useForm<ProformaInvoiceFormData>({
        resolver: zodResolver(ProformaInvoiceSchema),
        defaultValues: {
            id: `PI-${Date.now()}`,
            invoiceDate: format(new Date(), 'yyyy-MM-dd'),
            clientId: clientId || null,
            receiverName: '',
            receiverPosition: '',
            lpoNumber: '',
            location: '',
            region: 'Dar es Salaam',
            numberOfDays: 1,
            multiplyByDays: true,
            serviceCharge: 0,
            transportCosts: 0,
            vatType: 'inclusive',
            selectedEventType: eventTypes[0],
            customEventType: '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
            serviceFields: Object.fromEntries(serviceFieldsList.map(f => [f.key, true])),
            serviceDesc: '',
            items: [{ id: `ORD-${Date.now()}`, particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: format(new Date(), 'yyyy-MM-dd'), vatType: 'inclusive' }],
        }
    });

    const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "items" });
    
    const watchedFormValues = form.watch();
    const selectedClientId = form.watch('clientId');
    const selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : undefined;
    
    // Check for matching orders when client or dates change
    useEffect(() => {
        if (!selectedClientId || !watchedFormValues.startDate || !watchedFormValues.endDate || isEditMode) {
            setMatchingOrders([]);
            return;
        }

        const start = watchedFormValues.startDate;
        const end = watchedFormValues.endDate;

        const matches = orders.filter(order => {
            const belongsToClient = order.clientEvents.some(e => e.clientId === selectedClientId);
            if (!belongsToClient) return false;

            const inDateRange = order.clientEvents.some(e => e.date && e.date >= start && e.date <= end);
            if (!inDateRange) return false;

            // Don't suggest if already linked to a proforma
            if (order.proformaId) return false;

            // Don't suggest if already in current items
            const alreadyAdded = fields.some(f => f.id === order.id);
            if (alreadyAdded) return false;

            return true;
        });

        setMatchingOrders(matches);
    }, [selectedClientId, watchedFormValues.startDate, watchedFormValues.endDate, orders, fields, isEditMode]);

    const handleImportSelected = (orderList: Order[]) => {
        const currentItems = form.getValues('items');
        const isFirstItemEmpty = currentItems.length === 1 && !currentItems[0].unitPrice && currentItems[0].pax === 1;

        if (isFirstItemEmpty) {
            remove(0);
        }

        orderList.forEach(order => {
            order.clientEvents.forEach(event => {
                if (event.clientId === selectedClientId && event.date && event.date >= watchedFormValues.startDate && event.date <= watchedFormValues.endDate) {
                    append({
                        id: order.id || '',
                        particularType: 'event',
                        eventType: 'Catering services',
                        mealType: event.mealType || '',
                        pax: event.numberOfPeople || 0,
                        unitPrice: event.unitPrice || 0,
                        total: (event.numberOfPeople || 0) * (event.unitPrice || 0),
                        date: event.date,
                        vatType: event.vatType || 'inclusive',
                        particularDescription: `${event.mealType || 'Event'} on ${event.date ? format(parseISO(event.date), 'PPP') : ''}`
                    });
                }
            });
        });

        setMatchingOrders([]);
        setIsImportDialogOpen(false);
        toast({ title: "Orders Imported", description: `Added events from ${orderList.length} orders.` });
    };

    const handleSaveAndCreateOrder = async (itemIndex: number) => {
        const itemData = form.getValues(`items.${itemIndex}`);
        const client_id = form.getValues('clientId');
        const proformaId = form.getValues('id');

        if (!client_id) {
            toast({ variant: "destructive", title: "Client Not Selected", description: "Please select a client before creating or updating an order." });
            return;
        }
        if (!proformaId) {
            toast({ variant: "destructive", title: "Proforma ID Missing", description: "Cannot create/update an order without a proforma invoice ID." });
            return;
        }

        try {
            const isExistingOrder = orders.some(o => o.id === itemData.id);
            
            const recalculatedTotal = (itemData.pax || 0) * (itemData.unitPrice || 0);

            const orderPayload = {
                id: itemData.id,
                name: `Order for ${itemData.eventType} on ${itemData.date ? format(parseISO(itemData.date), 'PPP') : 'a future date'}`,
                description: `Order related to proforma ${proformaId}`,
                proformaId: proformaId,
                clientEvents: [{
                    clientId: client_id,
                    date: itemData.date || format(new Date(), 'yyyy-MM-dd'),
                    numberOfPeople: itemData.pax,
                    mealType: itemData.mealType,
                    unitPrice: itemData.unitPrice,
                    total: recalculatedTotal,
                    vatType: itemData.vatType,
                    recipes: getOrderById(itemData.id)?.clientEvents?.[0]?.recipes || [],
                }],
            };

            if (isExistingOrder) {
                const updatedOrder = await updateOrder(itemData.id!, orderPayload as any);
                if (updatedOrder) {
                    toast({ title: "Order Updated", description: `Order ${itemData.id} has been successfully updated.` });
                }
            } else {
                const newOrder = await addOrder(orderPayload as any);
                if (newOrder) {
                    update(itemIndex, { ...itemData, id: newOrder.id, total: recalculatedTotal });
                    toast({ title: "Order Created", description: `Order ${newOrder.id} has been saved.` });
                }
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
        
        const totalPax = items.reduce((sum, item) => sum + (item.pax || 0), 0);
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
                    if (fieldName === 'particularType' || fieldName === 'eventType' || fieldName === 'mealType' || fieldName === 'date' || fieldName === 'customEventType') {
                         if (item.particularType === 'event') {
                             form.setValue(`items.${index}.particularDescription`, item.eventType === 'Custom' ? item.customEventType || '' : `${item.eventType} on ${item.date ? format(parseISO(item.date), 'PPP') : ''}`)
                         } else if (item.particularType === 'meal') {
                             form.setValue(`items.${index}.particularDescription`, `${item.mealType} on ${item.date ? format(parseISO(item.date), 'PPP') : ''}`)
                         } else { // Custom
                            // particularDescription will be edited directly
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
                
                if(name === 'endDate' && endDate && isValid(parseISO(endDate))){
                    form.setValue('invoiceDate', endDate);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);

    useEffect(() => {
        if (isEditMode && invoiceId) {
            const dataToLoad = getProformaById(invoiceId);
            if (dataToLoad) {
                form.reset(dataToLoad);
            }
        } else if (!isEditMode && clientId) {
            form.reset({
                ...form.getValues(),
                clientId: clientId,
            });
        }
    }, [isEditMode, invoiceId, clientId, getProformaById, form]);

    async function onSubmit(data: ProformaInvoiceFormData) {
        setIsSubmitting(true);
        try {
            let result;
            if (isEditMode && invoiceId) {
                result = await updateProformaInvoice(invoiceId, data);
            } else {
                result = await addProformaInvoice(data);
            }

            if (result) {
                // Link all included orders to this proforma
                const uniqueOrderIds = Array.from(new Set(data.items.map(i => i.id).filter(id => id && id.startsWith('ORD-'))));
                for (const oid of uniqueOrderIds) {
                    await updateOrder(oid, { proformaId: result.id });
                }

                toast({ title: 'Success', description: `Proforma invoice ${isEditMode ? 'updated' : 'created'} successfully.` });
                router.push(`/proforma-invoices/${result.id}`);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to save proforma invoice.' });
            }
        } catch (error) {
            console.error("Failed to save proforma invoice", error);
            let message = "Failed to save proforma invoice.";
            if (error instanceof Error) {
                message = error.message;
            }
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const calculateSubtotal = () => form.getValues('items').reduce((sum, item) => sum + (item.total || 0), 0);
    const calculateTotalDays = () => form.getValues('multiplyByDays') ? calculateSubtotal() * (form.getValues('numberOfDays') || 1) : calculateSubtotal();
    const calculateVAT = () => {
        const totalBeforeVat = calculateTotalDays() + (form.getValues('serviceCharge') || 0) + (form.getValues('transportCosts') || 0);
        return form.getValues('vatType') === 'exclusive' ? totalBeforeVat * 0.18 : 0;
    };
    const calculateGrandTotal = () => calculateTotalDays() + (form.getValues('serviceCharge') || 0) + (form.getValues('transportCosts') || 0) + calculateVAT();


    return (
        <Card className="max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-3xl font-bold text-primary">{isEditMode ? "Edit Proforma Invoice" : "Create New Proforma Invoice"}</CardTitle>
                        <CardDescription>Fill in the details for the proforma invoice.</CardDescription>
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
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-lg font-semibold"><Info className="mr-2 h-5 w-5 text-primary" />Proforma Details</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Proforma Invoice Number</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="e.g., PI-2024-001" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="invoiceDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Proforma Invoice Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')} /></PopoverContent>
                                                </Popover>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="item-2">
                            <AccordionTrigger className="text-lg font-semibold"><User className="mr-2 h-5 w-5 text-primary" />Client Information</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="clientId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Select Client</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={clientsLoading || !!clientId}>
                                                                {clientsLoading ? "Loading..." : field.value ? clients.find(c => c.id === field.value)?.companyName : "Select client"}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </FormControl>
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
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="lpoNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>LPO Number</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter LPO number" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="receiverName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Receiver Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter receiver name" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="receiverPosition"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Receiver Position</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter receiver position" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="item-3">
                            <AccordionTrigger className="text-lg font-semibold"><Settings2 className="mr-2 h-5 w-5 text-primary" />Service Customization</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="startDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Start Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')} /></PopoverContent>
                                                </Popover>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="endDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>End Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')} /></PopoverContent>
                                                </Popover>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="numberOfDays"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Number of Days</FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="1" {...field} onChange={e=>field.onChange(parseInt(e.target.value) || 1)} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <FormField
                                        control={form.control}
                                        name="location"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Location</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Enter event location" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="region"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Region</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a region" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="mt-4 space-y-2">
                                    <Label>Event Type for Service Description</Label>
                                    <FormField
                                        control={form.control}
                                        name="selectedEventType"
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>{eventTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {form.watch("selectedEventType") === 'Custom' && (
                                        <FormField
                                            control={form.control}
                                            name="customEventType"
                                            render={({ field }) => (
                                                <Input {...field} placeholder="Custom Event Type" className="mt-2" />
                                            )}
                                        />
                                    )}

                                    <Label className="mt-4 block">Customize Service Description Fields</Label>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                                    {serviceFieldsList.map(field => (
                                        <div key={field.key} className="flex items-center space-x-2">
                                            <FormField
                                                control={form.control}
                                                name={`serviceFields.${field.key}`}
                                                render={({ field: checkboxField }) => (
                                                    <Checkbox
                                                        checked={checkboxField.value}
                                                        onCheckedChange={checkboxField.onChange}
                                                        id={`service-field-${field.key}`}
                                                    />
                                                )}
                                            />
                                        <Label htmlFor={`service-field-${field.key}`}>{field.label}</Label>
                                        </div>
                                    ))}
                                    </div>
                                    <Label className="mt-4 block">Service Description</Label>
                                    <FormField
                                        control={form.control}
                                        name="serviceDesc"
                                        render={({ field }) => (
                                            <Textarea {...field} rows={3} />
                                        )}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        </Accordion>
                        
                        {/* Matching Orders Alert */}
                        {matchingOrders.length > 0 && (
                            <Alert className="bg-primary/5 border-primary/20">
                                <AlertCircle className="h-4 w-4 text-primary" />
                                <AlertTitle>Orders Found</AlertTitle>
                                <AlertDescription className="flex items-center justify-between">
                                    <span>We found {matchingOrders.length} orders for this client in the selected date range. Do you want to include them?</span>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => handleImportSelected(matchingOrders)}>Import All</Button>
                                        <Button type="button" variant="secondary" size="sm" onClick={() => {
                                            setSelectedOrderIdsForImport(matchingOrders.map(o => o.id));
                                            setIsImportDialogOpen(true);
                                        }}>Review & Select</Button>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        <Card className="p-4 border-primary/20">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-primary flex items-center"><FileText className="mr-2 h-5 w-5"/>Invoice Items</h3>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={() => { 
                                        const newIndex = fields.length;
                                        append({ id: '', particularType: 'custom', eventType: '', mealType: '', pax: 1, unitPrice: 0, total: 0, date: undefined, particularDescription: 'New Bulk Item', vatType: 'inclusive' });
                                        setOpenAccordionItems([`item-${newIndex}`]);
                                    }} size="sm">
                                        <Pencil className="w-4 h-4 mr-2" /> Add Bulk Item
                                    </Button>
                                    <Button type="button" onClick={() => { 
                                        const newIndex = fields.length;
                                        append({ id: `ORD-${Date.now()}`, particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: format(new Date(), 'yyyy-MM-dd'), vatType: 'inclusive' });
                                        setOpenAccordionItems([`item-${newIndex}`]);
                                    }} size="sm">
                                        <Plus className="w-4 h-4 mr-2" /> Add Event Item
                                    </Button>
                                </div>
                            </div>
                            <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-2">
                                {fields.map((item, index) => {
                                    const orderId = form.getValues(`items.${index}.id`);
                                    const isSaved = orderId ? orders.some(o => o.id === orderId) : false;
                                    const particularType = form.watch(`items.${index}.particularType`);
                                    return (
                                    <AccordionItem key={item.id} value={`item-${index}`} className="border-b-0 rounded-md bg-card/60">
                                        <AccordionTrigger className="p-2 hover:no-underline rounded-md data-[state=open]:bg-primary/10">
                                            <div className="flex items-center gap-2 text-left">
                                                {isSaved && <CheckCircle className="h-5 w-5 text-green-500 shrink-0"/>}
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">Order Item #{index + 1}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{form.watch(`items.${index}.particularDescription`)}</span>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-4 pt-2 space-y-4">
                                             <FormField control={form.control} name={`items.${index}.particularType`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Particulars Display</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 pt-2">
                                                            <div className="flex items-center space-x-2"><RadioGroupItem value="event" id={`event-${index}`} /><Label htmlFor={`event-${index}`}>Event Type</Label></div>
                                                            <div className="flex items-center space-x-2"><RadioGroupItem value="meal" id={`meal-${index}`} /><Label htmlFor={`meal-${index}`}>Meal Type</Label></div>
                                                             <div className="flex items-center space-x-2"><RadioGroupItem value="custom" id={`custom-${index}`} /><Label htmlFor={`custom-${index}`}>Custom</Label></div>
                                                        </RadioGroup>
                                                    </FormControl>
                                                </FormItem>
                                            )} />

                                            {particularType === 'custom' ? (
                                                 <FormField control={form.control} name={`items.${index}.particularDescription`} render={({ field }) => (
                                                    <FormItem><FormLabel>Custom Particulars</FormLabel><FormControl><Input {...field} placeholder="e.g. 93 Cartons of Juice" /></FormControl></FormItem>
                                                )} />
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                                     <FormField control={form.control} name={`items.${index}.eventType`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Event Type</FormLabel>
                                                            <FormControl>
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                                                    <SelectContent>{eventTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </FormControl>
                                                        </FormItem>
                                                    )} />
                                                     <FormField control={form.control} name={`items.${index}.mealType`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Meal Type</FormLabel>
                                                            <FormControl>
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                                                    <SelectContent>{mealTypes.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </FormControl>
                                                        </FormItem>
                                                    )} />
                                                </div>
                                            )}
                                           
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                <FormField control={form.control} name={`items.${index}.pax`} render={({ field }) => (
                                                    <FormItem><FormLabel>Qty/Pax</FormLabel><FormControl><Input type="number" {...field} onChange={e=>field.onChange(parseInt(e.target.value) || 0)} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (
                                                    <FormItem><FormLabel>Unit Price</FormLabel><FormControl><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name={`items.${index}.total`} render={({ field }) => (
                                                    <FormItem><FormLabel>Total</FormLabel><FormControl><Input type="number" {...field} readOnly /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name={`items.${index}.date`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Event Date</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                                        {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                                                    </Button>
                                                                </FormControl>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')} /></PopoverContent>
                                                        </Popover>
                                                    </FormItem>
                                                )} />
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
                            <FormField control={form.control} name="serviceCharge" render={({ field }) => (
                                <FormItem><FormLabel>Service Charge (TSHS)</FormLabel><FormControl><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="transportCosts" render={({ field }) => (
                                <FormItem><FormLabel>Transport Costs (TSHS)</FormLabel><FormControl><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="vatType" render={({ field }) => (
                                <FormItem><FormLabel>VAT Type (Overall)</FormLabel>
                                    <FormControl>
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="inclusive">Inclusive</SelectItem><SelectItem value="exclusive">Exclusive (+18%)</SelectItem></SelectContent>
                                        </Select>
                                    </FormControl>
                                </FormItem>
                            )}/>
                        </div>
                        <FormField control={form.control} name="multiplyByDays" render={({ field }) => (
                            <div className="flex items-center space-x-2 pt-2">
                                <FormControl>
                                    <Checkbox id="multiply-days" checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <Label htmlFor="multiply-days">Multiply item totals by number of days</Label>
                            </div>
                        )}/>

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
                                {isEditMode ? 'Update and View Proforma' : 'Save and View Proforma'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>

            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Import Orders</DialogTitle>
                        <DialogDescription>Select which orders you want to include in this proforma invoice.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {matchingOrders.map(order => (
                            <div key={order.id} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => {
                                setSelectedOrderIdsForImport(prev => 
                                    prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id]
                                );
                            }}>
                                <Checkbox checked={selectedOrderIdsForImport.includes(order.id)} onCheckedChange={() => {}} />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <p className="font-medium">{order.name}</p>
                                        <Badge variant="outline" className="text-[10px]">{order.id}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{order.clientEvents.length} event(s) found</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button onClick={() => handleImportSelected(matchingOrders.filter(o => selectedOrderIdsForImport.includes(o.id)))}>Import Selected</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
