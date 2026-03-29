"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, type SubmitHandler, type SubmitErrorHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, Loader2, Save, ChevronsUpDown, Check, Settings2, User, Info, FileText, CheckCircle, Building, Pencil, AlertCircle, ArrowRight, ArrowLeft, Utensils, RefreshCw, Download } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useProformaInvoiceStorage } from '@/hooks/use-proforma-invoice-storage';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { ProformaInvoiceSchema, type ProformaInvoiceFormData } from '@/lib/schemas';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    const { clients, getClientById: getClientDetails, isLoading: clientsLoading } = useClientStorage();
    const { getProformaById, addProformaInvoice, updateProformaInvoice } = useProformaInvoiceStorage();
    const { orders, addOrder, updateOrder, getOrderById } = useOrderStorage();
    const { toast } = useToast();

    const isEditMode = !!invoiceId;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    // Suggestion state
    const [matchingOrders, setMatchingOrders] = useState<Order[]>([]);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedOrderIdsForImport, setSelectedOrderIdsForImport] = useState<string[]>([]);
    const [isServiceDescModified, setIsServiceDescModified] = useState(false);
    const [isPersistingDrafts, setIsPersistingDrafts] = useState(false);

    const form: UseFormReturn<ProformaInvoiceFormData> = useForm<ProformaInvoiceFormData>({
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
            items: [{ id: `EVT-${Date.now()}`, particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: format(new Date(), 'yyyy-MM-dd'), vatType: 'inclusive' }],
        }
    });

    const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "items" });
    
    const watchedFormValues = form.watch();
    const selectedClientId = form.watch('clientId');
    const selectedClient = useMemo(() => selectedClientId ? getClientDetails(selectedClientId) : null, [selectedClientId, getClientDetails]);

    // Check for matching orders
    useEffect(() => {
        const start = watchedFormValues.startDate;
        const end = watchedFormValues.endDate;

        if (!selectedClientId || !start || !end || isEditMode) {
            setMatchingOrders([]);
            return;
        }

        const currentItemIds = new Set(watchedFormValues.items.map(item => item.id));

        const matches = orders.filter(order => {
            const belongsToClient = order.clientId === selectedClientId;
            if (!belongsToClient) return false;

            const inDateRange = (order.startDate && order.startDate >= start && order.startDate <= end) || 
                               (order.endDate && order.endDate >= start && order.endDate <= end);
            if (!inDateRange) return false;

            // EXCLUDE orders already linked to a proforma
            if (order.proformaId) return false;

            if (currentItemIds.has(order.id)) return false;

            return true;
        });

        setMatchingOrders(matches);
    }, [selectedClientId, watchedFormValues.startDate, watchedFormValues.endDate, watchedFormValues.items, orders, isEditMode]);

    const handleImportSelected = (orderList: Order[]) => {
        const currentItems = form.getValues('items');
        const isFirstItemEmpty = currentItems.length === 1 && !currentItems[0].unitPrice && currentItems[0].pax === 1 && currentItems[0].id.includes('EVT-');

        if (isFirstItemEmpty) {
            remove(0);
        }

        const { startDate, endDate } = watchedFormValues;
        if (!startDate || !endDate) {
            toast({ variant: "destructive", title: "Missing Dates", description: "Start and end dates must be selected before importing orders." });
            return;
        }

        orderList.forEach(order => {
            order.clientEvents.forEach(event => {
                if (event.date && event.date >= startDate && event.date <= endDate) {
                    append({
                        id: event.id,
                        orderId: order.id,
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
        if (!isServiceDescModified) {
            form.setValue("serviceDesc", buildServiceDesc());
        }
    }, [watchedFormValues.serviceFields, watchedFormValues.items, watchedFormValues.numberOfDays, watchedFormValues.startDate, watchedFormValues.endDate, watchedFormValues.location, watchedFormValues.selectedEventType, watchedFormValues.customEventType, buildServiceDesc, form, isServiceDescModified]);

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
                    
                    if (fieldName === 'particularType' || fieldName === 'eventType' || fieldName === 'mealType' || fieldName === 'date') {
                        if (item.particularType === 'event') {
                            form.setValue(`items.${index}.particularDescription`, `${item.eventType || 'Event'} on ${item.date ? format(parseISO(item.date), 'PPP') : ''}`)
                        } else if (item.particularType === 'meal') {
                            form.setValue(`items.${index}.particularDescription`, `${item.mealType || 'Meal'} on ${item.date ? format(parseISO(item.date), 'PPP') : ''}`)
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
    }, [form]);

    useEffect(() => {
        if (isEditMode && invoiceId) {
            const found = getProformaById(invoiceId);
            if (found) {
                const dataToLoad: ProformaInvoiceFormData = {
                    id: found.id,
                    invoiceDate: found.invoiceDate,
                    clientId: found.clientId,
                    receiverName: found.receiverName,
                    receiverPosition: found.receiverPosition,
                    lpoNumber: found.lpoNumber,
                    location: found.location,
                    region: found.region,
                    numberOfDays: found.numberOfDays || 1,
                    multiplyByDays: found.multiplyByDays || false,
                    serviceCharge: found.serviceCharge || 0,
                    transportCosts: found.transportCosts || 0,
                    vatType: found.vatType,
                    selectedEventType: found.selectedEventType,
                    customEventType: found.customEventType,
                    startDate: found.startDate,
                    endDate: found.endDate,
                    serviceFields: found.serviceFields,
                    serviceDesc: found.serviceDesc,
                    items: found.items.map(item => ({
                        id: item.id || `EVT-${Date.now()}`,
                        orderId: item.orderId,
                        eventType: item.eventType,
                        customEventType: item.customEventType,
                        mealType: item.mealType,
                        pax: item.pax,
                        unitPrice: item.unitPrice,
                        total: item.total,
                        date: item.date,
                        particularType: item.particularType,
                        particularDescription: item.particularDescription,
                        vatType: item.vatType
                    }))
                };
                form.reset(dataToLoad);
            }
        } else if (clientId) {
            form.setValue('clientId', clientId);
        }
    }, [isEditMode, invoiceId, clientId, getProformaById, form]);

    const onSubmit: SubmitHandler<ProformaInvoiceFormData> = async (data) => {
        setIsSubmitting(true);
        try {
            let result;
            if (isEditMode && invoiceId) {
                result = await updateProformaInvoice(invoiceId, data);
            } else {
                result = await addProformaInvoice(data);
            }

            if (result) {
                // Determine which items are "New Orders" that need persistence
                const newOrderItems = data.items.filter(item => item.orderId && item.orderId.startsWith('DRAFT-ORD-'));
                
                // Group by temporary Order ID
                const orderGroups = new Map<string, typeof newOrderItems>();
                newOrderItems.forEach(item => {
                    const group = orderGroups.get(item.orderId!) || [];
                    group.push(item);
                    orderGroups.set(item.orderId!, group);
                });

                // Persist new orders with ORD-XXXXX and EVT-XXXXX
                for (const [tempId, groupItems] of orderGroups.entries()) {
                    const validItems = groupItems.filter(i => i.date);
                    if (validItems.length === 0) continue;

                    const eventDates = validItems.map(i => new Date(i.date!));
                    const startDate = format(new Date(Math.min(...eventDates.map(d => d.getTime()))), 'yyyy-MM-dd');
                    const endDate = format(new Date(Math.max(...eventDates.map(d => d.getTime()))), 'yyyy-MM-dd');

                    const firstItem = validItems[0];
                    const orderPayload = {
                        name: `Order for ${data.clientId} - ${firstItem.particularDescription}`,
                        clientId: data.clientId!,
                        startDate: startDate,
                        endDate: endDate,
                        description: `Manually defined via Proforma ${result.id}`,
                        proformaId: result.id,
                        clientEvents: validItems.map(gi => ({
                            id: gi.id, 
                            mealType: gi.mealType,
                            eventType: gi.eventType,
                            numberOfPeople: gi.pax,
                            unitPrice: gi.unitPrice,
                            total: gi.total,
                            date: gi.date,
                            vatType: gi.vatType,
                            clientId: data.clientId!,
                            particularDescription: gi.particularDescription,
                            particularType: gi.particularType
                        }))
                    };

                    await addOrder(orderPayload as any);
                }

                // Link existing orders to the document
                const existingOrderIds = Array.from(new Set(
                    data.items
                        .map(i => i.orderId)
                        .filter(id => id && id.startsWith('ORD-'))
                )) as string[];

                for (const oid of existingOrderIds) {
                    await updateOrder(oid, { proformaId: result.id } as any);
                }

                toast({ title: 'Success', description: `Proforma ${isEditMode ? 'updated' : 'created'} successfully and source orders processed.` });
                router.push(`/proforma-invoices/${result.id}`);
            }
        } catch (error) {
            console.error("Failed to save proforma", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save proforma.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const persistDraftOrders = async () => {
        const data = form.getValues();
        const newOrderItems = data.items.filter(item => item.orderId && item.orderId.startsWith('DRAFT-ORD-'));
        
        if (newOrderItems.length === 0) {
            toast({ title: 'No Drafts', description: 'All orders are already saved.' });
            return;
        }

        setIsPersistingDrafts(true);
        try {
            const docId = invoiceId || data.id || `TEMP-DOC-${Date.now()}`;
            
            const orderGroups = new Map<string, typeof newOrderItems>();
            newOrderItems.forEach(item => {
                const group = orderGroups.get(item.orderId!) || [];
                group.push(item);
                orderGroups.set(item.orderId!, group);
            });

            for (const [tempOrderId, groupItems] of orderGroups.entries()) {
                const validItems = groupItems.filter(i => i.date);
                if (validItems.length === 0) continue;

                const eventDates = validItems.map(i => new Date(i.date!));
                const startDate = format(new Date(Math.min(...eventDates.map(d => d.getTime()))), 'yyyy-MM-dd');
                const endDate = format(new Date(Math.max(...eventDates.map(d => d.getTime()))), 'yyyy-MM-dd');

                const firstItem = validItems[0];
                const orderPayload = {
                    name: `Order for ${data.clientId} - ${firstItem.particularDescription}`,
                    clientId: data.clientId!,
                    startDate,
                    endDate,
                    description: `Manually defined via Proforma Wizard.`,
                    proformaId: docId.startsWith('TEMP-') ? null : docId, 
                    clientEvents: validItems.map(gi => ({
                        id: gi.id, 
                        mealType: gi.mealType,
                        eventType: gi.eventType,
                        numberOfPeople: gi.pax,
                        unitPrice: gi.unitPrice,
                        total: gi.total,
                        date: gi.date,
                        vatType: gi.vatType,
                        clientId: data.clientId!,
                        particularDescription: gi.particularDescription,
                        particularType: gi.particularType
                    }))
                };

                const newOrder = await addOrder(orderPayload as any);
                if (newOrder) {
                    const currentItems = form.getValues('items');
                    const updatedItems = currentItems.map(ci => {
                        if (ci.orderId === tempOrderId) {
                            const matchingEvent = newOrder.clientEvents?.find(e => 
                                e.particularDescription === ci.particularDescription && 
                                e.date === ci.date
                            );
                            return {
                                ...ci,
                                orderId: newOrder.id,
                                id: matchingEvent?.id || ci.id
                            };
                        }
                        return ci;
                    });
                    form.setValue('items', updatedItems);
                }
            }

            toast({ title: 'Save Successful', description: 'Draft orders have been persisted to the system.' });
        } catch (error) {
            console.error("Error persisting drafts", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to persist draft orders.' });
        } finally {
            setIsPersistingDrafts(false);
        }
    }

    const onInvalid: SubmitErrorHandler<ProformaInvoiceFormData> = (errors) => {
        console.error("Form invalid", errors);
        const errorMessages = Object.entries(errors)
            .map(([key, error]: [string, any]) => {
                if (key === 'items' && Array.isArray(error)) {
                    return "At least one item is required with a valid price and pax.";
                }
                return error?.message || `${key} is invalid`;
            })
            .filter(Boolean);

        toast({
            variant: 'destructive',
            title: `Submission Failed`,
            description: (
                <div className="mt-2 text-xs space-y-1">
                    <p className="font-bold underline mb-2">Please correct the following:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        {errorMessages.map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                </div>
            )
        });
    }

    const calculateSubtotal = () => form.getValues('items').reduce((sum, item) => sum + (item.total || 0), 0);
    const calculateTotalDays = () => form.getValues('multiplyByDays') ? calculateSubtotal() * (form.getValues('numberOfDays') || 1) : calculateSubtotal();
    const calculateVAT = () => {
        const total = calculateTotalDays() + (form.getValues('serviceCharge') || 0) + (form.getValues('transportCosts') || 0);
        return form.getValues('vatType') === 'exclusive' ? total * 0.18 : 0;
    };
    const calculateGrandTotal = () => calculateTotalDays() + (form.getValues('serviceCharge') || 0) + (form.getValues('transportCosts') || 0) + calculateVAT();

    const steps = [
        { id: 1, title: 'Identity', desc: 'Recipient & ID', icon: User },
        { id: 2, title: 'Services', desc: 'Line Items', icon: Utensils },
        { id: 3, title: 'Financials', desc: 'Charges & Fee', icon: Settings2 },
        { id: 4, title: 'Review', desc: 'Final Check', icon: FileText },
    ];

    const stepFields = [
        ['clientId', 'startDate', 'endDate'],
        ['items'],
        ['vatType'],
    ];

    const nextStep = async () => {
        const fields = stepFields[currentStep - 1] as any;
        const isValid = await form.trigger(fields);
        if (isValid) {
            setCurrentStep(prev => Math.min(prev + 1, 4));
        } else {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please correct mandatory fields.' });
        }
    };

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-8">
                    {/* Progress Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {steps.map((step) => {
                        const Icon = step.icon;
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;

                        return (
                            <div 
                                key={step.id} 
                                className={cn(
                                    "relative p-4 rounded-2xl border transition-all duration-300 overflow-hidden",
                                    isActive ? "bg-primary border-primary shadow-lg shadow-primary/20" : 
                                    isCompleted ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                                        isActive ? "bg-white/20 text-white" : 
                                        isCompleted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                    )}>
                                        {isCompleted ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                                    </div>
                                    <div className="hidden md:block">
                                        <p className={cn("text-[10px] uppercase font-black tracking-widest", isActive ? "text-white/60" : "text-muted-foreground")}>Step 0{step.id}</p>
                                        <p className={cn("font-bold text-sm", isActive ? "text-white" : "text-foreground")}>{step.title}</p>
                                    </div>
                                </div>
                                {isActive && (
                                    <motion.div layoutId="activeStep" className="absolute bottom-0 left-0 h-1 bg-white/40" initial={{ width: 0 }} animate={{ width: '100%' }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <Card className="shadow-2xl border-none overflow-hidden bg-card/50 backdrop-blur-sm">
                    <CardHeader className="border-b bg-muted/20 pb-8">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                                    <FileText className="h-7 w-7" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black tracking-tight uppercase">
                                        {isEditMode ? "Modify Proforma" : "Proforma Wizard"}
                                    </CardTitle>
                                    <CardDescription>{steps[currentStep-1].desc}</CardDescription>
                                </div>
                            </div>
                            <Badge variant="outline" className="h-8 px-3 font-bold bg-background/50 border-primary/20 text-primary uppercase tracking-widest">
                                Preliminary Draft
                            </Badge>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="pt-8 min-h-[500px]">
                        <Form {...form}>
                            <form className="space-y-8">
                                <AnimatePresence mode="wait">
                                    {currentStep === 1 && (
                                        <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                                            <div className="space-y-6">
                                                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2"><User className="h-5 w-5 text-primary" /> Recipient</h3>
                                                <FormField control={form.control} name="clientId" render={({ field }) => (
                                                    <FormItem><FormLabel className="font-semibold text-primary">BILLED TO (CLIENT)</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                            <FormControl><SelectTrigger className="h-12 text-lg font-bold border-2 focus:ring-primary"><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                                                            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>

                                            <div className="space-y-6">
                                                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2"><CalendarIcon className="h-5 w-5 text-primary" /> Service Period</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField control={form.control} name="startDate" render={({ field }) => (
                                                        <FormItem className="flex flex-col"><FormLabel className="font-semibold">START DATE</FormLabel>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <FormControl><Button variant={"outline"} className={cn("h-11 border-2 w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                                        {field.value ? format(parseISO(field.value), "dd/MM/yyyy") : <span>Pick a date</span>}
                                                                    </Button></FormControl>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0" align="start">
                                                                    <Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} initialFocus />
                                                                </PopoverContent>
                                                            </Popover>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                    <FormField control={form.control} name="endDate" render={({ field }) => (
                                                        <FormItem className="flex flex-col"><FormLabel className="font-semibold">END DATE</FormLabel>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <FormControl><Button variant={"outline"} className={cn("h-11 border-2 w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                                        {field.value ? format(parseISO(field.value), "dd/MM/yyyy") : <span>Pick a date</span>}
                                                                    </Button></FormControl>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0" align="start">
                                                                    <Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} disabled={(date) => !!form.getValues('startDate') && date < parseISO(form.getValues('startDate'))} initialFocus />
                                                                </PopoverContent>
                                                            </Popover>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2"><Info className="h-5 w-5 text-primary" /> Registry Info</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField control={form.control} name="id" render={({ field }) => (
                                                        <FormItem><FormLabel className="font-semibold text-muted-foreground uppercase text-[10px] tracking-widest">Proforma No.</FormLabel><FormControl><Input {...field} className="h-11 bg-muted/30 border-dashed" /></FormControl><FormMessage /></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                                                        <FormItem className="flex flex-col"><FormLabel className="font-semibold text-muted-foreground uppercase text-[10px] tracking-widest">Date issued</FormLabel>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <FormControl><Button variant={"outline"} className={cn("h-11 bg-muted/30 border-dashed w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                                        {field.value ? format(parseISO(field.value), "dd/MM/yyyy") : <span>Pick a date</span>}
                                                                    </Button></FormControl>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0" align="start">
                                                                    <Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} initialFocus />
                                                                </PopoverContent>
                                                            </Popover>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {currentStep === 2 && (
                                        <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                                             <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                                                <h3 className="text-lg font-bold flex items-center gap-2 text-primary"><Utensils className="h-5 w-5" /> Line Items</h3>
                                                <div className="flex items-center gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={persistDraftOrders} disabled={isPersistingDrafts || !form.watch('items').some(i => i.orderId?.startsWith('DRAFT-'))} className="bg-background">
                                                        {isPersistingDrafts ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                                        Save Draft Orders
                                                    </Button>
                                                    <Button type="button" size="sm" onClick={() => append({ 
                                                        id: `DRAFT-EVT-${Date.now()}`, 
                                                        orderId: `DRAFT-ORD-${Date.now()}`, 
                                                        particularType: 'event', 
                                                        eventType: eventTypes[0], 
                                                        mealType: mealTypes[0], 
                                                        pax: 1, 
                                                        unitPrice: 0, 
                                                        total: 0, 
                                                        date: format(new Date(), 'yyyy-MM-dd'), 
                                                        vatType: 'inclusive' 
                                                    })}>
                                                        <Plus className="w-4 h-4 mr-1" /> Add Row
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="rounded-xl border overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50 border-b">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left w-[120px]">Category</th>
                                                            <th className="px-4 py-3 text-left w-[150px]">Type</th>
                                                            <th className="px-4 py-3 text-left w-[140px]">Date</th>
                                                            <th className="px-4 py-3 text-left">Final Particulars</th>
                                                            <th className="px-4 py-3 text-right w-[80px]">Qty</th>
                                                            <th className="px-4 py-3 text-right w-[100px]">Rate</th>
                                                            <th className="px-4 py-3 text-right w-[110px]">Total</th>
                                                            <th className="px-4 py-3 text-center w-20">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                         {fields.map((item, index) => {
                                                            const itemType = form.watch(`items.${index}.particularType`);
                                                            
                                                            return (
                                                                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                                                    <td className="px-4 py-3">
                                                                        <FormField control={form.control} name={`items.${index}.particularType`} render={({ field }) => (
                                                                            <FormItem>
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="event">Event</SelectItem>
                                                                                        <SelectItem value="meal">Meal</SelectItem>
                                                                                        <SelectItem value="custom">Custom</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </FormItem>
                                                                        )} />
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {itemType === 'event' && (
                                                                            <FormField control={form.control} name={`items.${index}.eventType`} render={({ field }) => (
                                                                                <FormItem>
                                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                                        <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                                                        <SelectContent>
                                                                                            {eventTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </FormItem>
                                                                            )} />
                                                                        )}
                                                                        {itemType === 'meal' && (
                                                                            <FormField control={form.control} name={`items.${index}.mealType`} render={({ field }) => (
                                                                                <FormItem>
                                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                                        <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                                                        <SelectContent>
                                                                                            {mealTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </FormItem>
                                                                            )} />
                                                                        )}
                                                                        {itemType === 'custom' && (
                                                                            <div className="text-[10px] text-muted-foreground italic font-semibold uppercase">Custom Entry</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <FormField control={form.control} name={`items.${index}.date`} render={({ field }) => (
                                                                            <FormItem className="flex flex-col">
                                                                                <Popover>
                                                                                    <PopoverTrigger asChild>
                                                                                        <FormControl><Button variant={"outline"} className={cn("h-9 border w-full justify-start text-left font-normal text-xs px-2", !field.value && "text-muted-foreground")}>
                                                                                            {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "dd/MM/yyyy") : <span>DD/MM/YYYY</span>}
                                                                                        </Button></FormControl>
                                                                                    </PopoverTrigger>
                                                                                    <PopoverContent className="w-auto p-0" align="start">
                                                                                        <Calendar 
                                                                                            mode="single" 
                                                                                            selected={field.value ? parseISO(field.value) : undefined} 
                                                                                            onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} 
                                                                                            disabled={(date) => {
                                                                                                const s = form.getValues('startDate');
                                                                                                const e = form.getValues('endDate');
                                                                                                if (!s || !e) return false;
                                                                                                return date < parseISO(s) || date > parseISO(e);
                                                                                            }}
                                                                                            initialFocus 
                                                                                        />
                                                                                    </PopoverContent>
                                                                                </Popover>
                                                                            </FormItem>
                                                                        )} />
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <FormField control={form.control} name={`items.${index}.particularDescription`} render={({ field }) => <FormItem><FormControl><Input {...field} className="h-9" /></FormControl><FormMessage /></FormItem>} />
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <FormField control={form.control} name={`items.${index}.pax`} render={({ field }) => <FormItem><FormControl><Input type="number" {...field} className="h-9 text-right" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>} />
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => <FormItem><FormControl><Input type="number" {...field} className="h-9 text-right" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>} />
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-bold">
                                                                        {form.watch(`items.${index}.total`).toLocaleString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        {item.orderId?.startsWith('ORD-') ? (
                                                                             <div className="flex flex-col items-center gap-1">
                                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[9px] font-bold">SAVED</Badge>
                                                                                <span className="text-[8px] text-muted-foreground font-mono">{item.orderId}</span>
                                                                             </div>
                                                                        ) : (
                                                                            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive transition-colors">
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </Button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}

                                    {currentStep === 3 && (
                                        <motion.div key="step3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                <FormField control={form.control} name="serviceCharge" render={({ field }) => (
                                                    <FormItem><FormLabel className="font-semibold">Service Charge</FormLabel><FormControl><Input type="number" {...field} className="h-11" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="transportCosts" render={({ field }) => (
                                                    <FormItem><FormLabel className="font-semibold">Transport Costs</FormLabel><FormControl><Input type="number" {...field} className="h-11" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="vatType" render={({ field }) => (
                                                    <FormItem><FormLabel className="font-semibold">VAT Type</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="inclusive">Inclusive</SelectItem>
                                                                <SelectItem value="exclusive">Exclusive (18%)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>

                                            <div className="space-y-4 pt-4 border-t">
                                                <FormField control={form.control} name="serviceDesc" render={({ field }) => (
                                                    <FormItem>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <FormLabel className="font-bold flex items-center gap-2 text-primary"><Settings2 className="h-4 w-4" /> Service Description (Editable)</FormLabel>
                                                            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] font-black italic" onClick={() => { setIsServiceDescModified(false); form.setValue("serviceDesc", buildServiceDesc()); }}>
                                                                <RefreshCw className="h-3 w-3 mr-1" /> RESET TO DEFAULT
                                                            </Button>
                                                        </div>
                                                        <FormControl>
                                                            <Textarea 
                                                                {...field} 
                                                                className="min-h-[120px] font-medium text-sm border-2 focus:ring-primary leading-relaxed bg-primary/5" 
                                                                onChange={e => { field.onChange(e); setIsServiceDescModified(true); }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                        </motion.div>
                                    )}

                                    {currentStep === 4 && (
                                        <motion.div key="step4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6 text-center py-10">
                                            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
                                                <CheckCircle className="h-12 w-12" />
                                            </div>
                                            <h2 className="text-2xl font-black italic">PROFORMA READY</h2>
                                            <p className="text-muted-foreground max-w-sm mx-auto">Please review the financial totals in the sidebar before finalizing this proforma invoice.</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex justify-between items-center pt-8 border-t">
                                    <Button type="button" variant="outline" size="lg" onClick={prevStep} disabled={currentStep === 1} className="h-12 px-8 font-bold">
                                        <ArrowLeft className="mr-2 h-4 w-4" /> REVERT
                                    </Button>
                                    {currentStep < 4 ? (
                                        <Button type="button" size="lg" onClick={nextStep} className="h-12 px-10 font-black italic bg-primary hover:bg-primary/90">
                                            PROCEED <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </Button>
                                    ) : (
                                        <Button type="button" size="lg" disabled={isSubmitting} onClick={form.handleSubmit(onSubmit, onInvalid)} className="h-12 px-14 font-black italic bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/40">
                                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> FINALIZING...</> : <><CheckCircle className="mr-2 h-4 w-4" /> SAVE PROFORMA</>}
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>

            {/* Sidebar Summary */}
            <div className="w-full lg:w-[400px] flex flex-col gap-6">
                <Card className="sticky top-8 shadow-2xl border-none overflow-hidden bg-background border-t-4 border-primary">
                    <div className="bg-primary px-6 py-6 text-primary-foreground relative overflow-hidden">
                        <FileText className="absolute top-0 right-0 h-24 w-24 opacity-10 rotate-12" />
                        <h3 className="font-black uppercase tracking-widest text-lg italic">Proforma Summary</h3>
                        <p className="text-primary-foreground/60 text-xs font-bold mt-1 uppercase">Live Quote View</p>
                    </div>
                    <CardContent className="p-8 space-y-8">
                        <div className="space-y-6">
                            {selectedClient ? (
                                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                    <Label className="text-[10px] uppercase font-black text-primary tracking-widest">Client Root</Label>
                                    <p className="font-black text-lg truncate flex items-center gap-2 mt-1"><Building className="h-4 w-4" /> {selectedClient.companyName}</p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 text-center bg-muted/20">
                                    <AlertCircle className="h-5 w-5 text-muted-foreground opacity-50" />
                                    <p className="text-[10px] font-black uppercase text-muted-foreground italic">Pending client selection</p>
                                </div>
                            )}

                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-muted-foreground uppercase">Items Base</span>
                                    <span className="font-extrabold">{calculateSubtotal().toLocaleString()} TZS</span>
                                </div>
                                {watchedFormValues.multiplyByDays && (
                                    <div className="flex justify-between items-center text-xs p-2 rounded bg-primary/5 text-primary italic font-bold">
                                        <span>Multi-Day ({watchedFormValues.numberOfDays}d)</span>
                                        <span>× {watchedFormValues.numberOfDays}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-muted-foreground uppercase">Logistics Fee</span>
                                    <span className="font-extrabold">{((watchedFormValues.serviceCharge || 0) + (watchedFormValues.transportCosts || 0)).toLocaleString()} TZS</span>
                                </div>
                                <div className="flex justify-between items-center text-amber-600 font-bold">
                                    <span className="text-xs uppercase">VAT ({watchedFormValues.vatType})</span>
                                    <span>{calculateVAT().toLocaleString()} TZS</span>
                                </div>
                            </div>

                            <div className="pt-8 border-t-2 border-dashed relative">
                                <div className="absolute -left-10 -top-[1.5px] h-3 w-3 rounded-full bg-muted/20" />
                                <div className="absolute -right-10 -top-[1.5px] h-3 w-3 rounded-full bg-muted/20" />
                                <div className="flex justify-between items-end">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Est. Payable</span>
                                        <p className="text-xs text-muted-foreground italic">Pending final confirmation</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-black text-primary tracking-tighter">{calculateGrandTotal().toLocaleString()}</span>
                                        <span className="text-[10px] font-bold ml-1 text-primary">TZS</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col gap-2">
                                <Button variant="outline" className="w-full border-dashed border-2 font-black italic h-11" onClick={() => form.reset()}><RefreshCw className="h-4 w-4 mr-2 opacity-50" /> CLEAR FORM</Button>
                                {matchingOrders.length > 0 && (
                                    <Button variant="secondary" className="w-full font-black italic h-11 bg-primary/10 text-primary hover:bg-primary/20" onClick={() => setIsImportDialogOpen(true)}><Download className="h-4 w-4 mr-2" /> SYNC ORDERS</Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            </div>

            {/* Sync Modal */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                    <div className="bg-primary px-8 py-8 text-primary-foreground relative">
                        <Settings2 className="absolute -bottom-4 -right-4 h-32 w-32 opacity-10" />
                        <DialogTitle className="text-2xl font-black italic tracking-tight">DATA SYNC HUB</DialogTitle>
                        <DialogDescription className="text-primary-foreground/70 font-bold uppercase text-xs mt-1">Select valid orders for proforma</DialogDescription>
                    </div>
                    <div className="p-8 space-y-4 max-h-[400px] overflow-y-auto">
                        {matchingOrders.map(order => (
                            <div 
                                key={order.id} 
                                className={cn(
                                    "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between",
                                    selectedOrderIdsForImport.includes(order.id) ? "bg-primary border-primary text-primary-foreground" : "hover:bg-muted/50 border-transparent"
                                )}
                                onClick={() => setSelectedOrderIdsForImport(prev => prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id])}
                            >
                                <div>
                                    <p className="font-black text-lg">{order.name}</p>
                                    <p className={cn("text-xs font-bold opacity-60", selectedOrderIdsForImport.includes(order.id) ? "text-white" : "text-muted-foreground")}>{order.id} • {order.startDate}</p>
                                </div>
                                <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center", selectedOrderIdsForImport.includes(order.id) ? "bg-white text-primary" : "border-muted-foreground/30")}>
                                    {selectedOrderIdsForImport.includes(order.id) && <Check className="h-4 w-4" />}
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter className="p-8 bg-muted/20 border-t flex items-center justify-between">
                        <DialogClose asChild><Button variant="ghost" className="font-bold">CANCEL</Button></DialogClose>
                        <Button 
                            className="bg-primary hover:bg-primary/90 font-black italic px-8" 
                            disabled={selectedOrderIdsForImport.length === 0}
                            onClick={() => handleImportSelected(matchingOrders.filter(o => selectedOrderIdsForImport.includes(o.id)))}
                        >
                            IMPORT {selectedOrderIdsForImport.length} ORDERS
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
