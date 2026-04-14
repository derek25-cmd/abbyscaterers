"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, PlusCircle, Trash2, Loader2, Save, ChevronsUpDown, Check, Settings2, User, Info, FileText, CheckCircle, Building, Pencil, AlertCircle, ArrowRight, ArrowLeft, Utensils, RefreshCw, Download } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useProformaInvoiceStorage } from '@/hooks/use-proforma-invoice-storage';
import { useInvoiceStorage } from '@/hooks/use-invoice-storage';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useBookingStorage } from '@/hooks/use-booking-storage';
import { useSettingsStorage } from '@/hooks/use-settings-storage';
import { FinalInvoiceSchema, type FinalInvoiceFormData } from '@/lib/schemas';
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
    const { settings, updateSettings, isLoading: settingsLoading } = useSettingsStorage();
    const { toast } = useToast();

    const isEditMode = !!invoiceId;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(['item-0']);

    // Suggestion state
    const [matchingOrders, setMatchingOrders] = useState<Order[]>([]);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedOrderIdsForImport, setSelectedOrderIdsForImport] = useState<string[]>([]);
    const [isServiceDescModified, setIsServiceDescModified] = useState(false);
    const [isPersistingDrafts, setIsPersistingDrafts] = useState(false);

    const form = useForm<FinalInvoiceFormData>({
        resolver: zodResolver(FinalInvoiceSchema),
        defaultValues: {
            id: `INV-${Date.now()}`,
            proformaId: proformaId,
            status: 'outstanding',
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
            items: [],
            signedAtDate: format(new Date(), 'yyyy-MM-dd'),
            signedAtLocation: 'Dar es Salaam',
            appendProformaId: true,
            paymentDate: null,
        }
    });

    const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "items" });
    
    const watchedFormValues = form.watch();
    const selectedClientId = form.watch('clientId');
    const selectedClient = useMemo(() => selectedClientId ? getClientDetails(selectedClientId) : null, [selectedClientId, getClientDetails]);
    const invoiceStatus = form.watch('status');

    useEffect(() => {
        if (!settingsLoading && !isEditMode) {
            const currentId = form.getValues('id');
            // If the ID is the default INV-timestamp, replace it with our configured number.
            if (currentId && currentId.startsWith('INV-17')) {
                form.setValue('id', String(settings.nextInvoiceNumber || 1).padStart(5, '0'));
            }
        }
    }, [settingsLoading, settings.nextInvoiceNumber, isEditMode, form]);

    // Check for matching orders
    useEffect(() => {
        const start = watchedFormValues.startDate;
        const end = watchedFormValues.endDate;

        if (!selectedClientId || !start || !end || isEditMode || !!proformaId) {
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
    }, [selectedClientId, watchedFormValues.startDate, watchedFormValues.endDate, watchedFormValues.items, orders, isEditMode, proformaId]);

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

    useEffect(() => {
        if (invoiceStatus === 'paid' && !form.getValues('paymentDate')) {
            form.setValue('paymentDate', format(new Date(), 'yyyy-MM-dd'));
        }
    }, [invoiceStatus, form]);

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
                    invoiceDate: format(new Date(), 'yyyy-MM-dd'),
                    items: proforma.items.map(pi => ({
                        id: pi.id,
                        orderId: pi.orderId,
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
                    signedAtDate: format(new Date(), 'yyyy-MM-dd'),
                    signedAtLocation: 'Dar es Salaam',
                    appendProformaId: true,
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
                    invoiceDate: format(new Date(), 'yyyy-MM-dd'),
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
                        id: event.id,
                        orderId: order.id,
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
                    signedAtDate: format(new Date(), 'yyyy-MM-dd'),
                    signedAtLocation: 'Dar es Salaam'
                 };
            }
        } else if (clientId) {
            dataToLoad = { ...form.getValues(), clientId: clientId };
        }

        if (dataToLoad) {
            form.reset(dataToLoad);
        }

    }, [isEditMode, invoiceId, proformaId, bookingId, clientId, getInvoiceById, getProformaById, getBookingById, getOrdersByBookingId, form]);

    async function onSubmit(data: FinalInvoiceFormData) {
        setIsSubmitting(true);
        try {
            // 1. First, ensure all draft orders are persisted to the database
            // This will replace DRAFT-ORD- IDs with real ORD-XXXXX IDs in the form state
            await persistDraftOrders();
            
            // 2. Get the fresh values from the form (now containing real Order IDs)
            const freshData = form.getValues();
            
            let result;
            if (isEditMode && invoiceId) {
                result = await updateInvoice(invoiceId, freshData);
            } else {
                result = await addInvoice(freshData);
            }

            if (result) {
                // 3. Link existing or newly created orders to this invoice/proforma chain
                const linkedOrderIds = Array.from(new Set(
                    freshData.items
                        .map(i => i.orderId)
                        .filter(id => id && id.startsWith('ORD-'))
                )) as string[];

                for (const oid of linkedOrderIds) {
                    await updateOrder(oid, { proformaId: freshData.proformaId || '' } as any);
                }

                if (!isEditMode) {
                    updateSettings({ nextInvoiceNumber: (settings.nextInvoiceNumber || 1) + 1 });
                }

                toast({ title: 'Success', description: `Invoice ${isEditMode ? 'updated' : 'created'} successfully and source orders processed.` });
                router.push(`/invoices/${result.id}`);
            }
        } catch (error) {
            console.error("Failed to save invoice", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save invoice.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const persistDraftOrders = async (targetOrderId?: string) => {
        const data = form.getValues();
        const newOrderItems = data.items.filter(item => {
            const isDraft = item.orderId && item.orderId.startsWith('DRAFT-ORD-');
            if (!isDraft) return false;
            if (targetOrderId && item.orderId !== targetOrderId) return false;
            return true;
        });
        
        if (newOrderItems.length === 0) {
            if (targetOrderId) {
                toast({ title: 'Already Saved', description: 'This order is already persisted.' });
            } else {
                toast({ title: 'No Drafts', description: 'All orders are already saved.' });
            }
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

            let currentItemsForDrafts = [...form.getValues('items')];
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
                    description: `Manually defined via Invoice Wizard.`,
                    proformaId: data.proformaId || null, 
                    clientEvents: validItems.map(gi => ({
                        id: gi.id, 
                        mealType: gi.mealType,
                        eventType: gi.eventType,
                        numberOfPeople: Number(gi.pax) || 0,
                        unitPrice: Number(gi.unitPrice) || 0,
                        total: (Number(gi.pax) || 0) * (Number(gi.unitPrice) || 0),
                        date: gi.date,
                        vatType: gi.vatType,
                        clientId: data.clientId!,
                        particularDescription: gi.particularDescription,
                        particularType: gi.particularType,
                        recipes: []
                    }))
                };

                const newOrder = await addOrder(orderPayload as any);
                if (newOrder) {
                    currentItemsForDrafts = currentItemsForDrafts.map(ci => {
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
                }
            }
            form.setValue('items', currentItemsForDrafts);

            toast({ title: 'Save Successful', description: 'Draft orders have been persisted to the system.' });
        } catch (error) {
            console.error("Error persisting drafts", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to persist draft orders.' });
        } finally {
            setIsPersistingDrafts(false);
        }
    }

    function onInvalid(errors: any) {
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
        ['clientId', 'status', 'startDate', 'endDate'],
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
                                        {isEditMode ? "Modify Entry" : "Creation Wizard"}
                                    </CardTitle>
                                    <CardDescription>{steps[currentStep-1].desc}</CardDescription>
                                </div>
                            </div>
                            <Badge variant="outline" className="h-8 px-3 font-bold bg-background/50 border-primary/20 text-primary uppercase tracking-widest">
                                Working Draft
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
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                    <FormField control={form.control} name="multiplyByDays" render={({ field }) => (
                                                        <FormItem className="flex flex-col"><FormLabel className="font-semibold">BILLING BEHAVIOR</FormLabel>
                                                            <div className="flex h-11 items-center space-x-3 rounded-md border-2 px-3 bg-muted/20">
                                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Multiply Subtotal by Days</span>
                                                            </div>
                                                        </FormItem>
                                                    )} />
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2"><Info className="h-5 w-5 text-primary" /> Registry Info</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField control={form.control} name="id" render={({ field }) => (
                                                        <FormItem><FormLabel className="font-semibold text-muted-foreground uppercase text-[10px] tracking-widest">Invoice No.</FormLabel><FormControl><Input {...field} className="h-11 bg-muted/30 border-dashed" /></FormControl><FormMessage /></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name="status" render={({ field }) => (
                                                        <FormItem><FormLabel className="font-semibold text-muted-foreground uppercase text-[10px] tracking-widest">Status</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl><SelectTrigger className="h-11 bg-muted/30 border-dashed"><SelectValue /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="outstanding">Outstanding</SelectItem>
                                                                    <SelectItem value="paid">Paid</SelectItem>
                                                                    <SelectItem value="partially paid">Partially Paid</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                </div>
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
                                        </motion.div>
                                    )}

                                     {currentStep === 2 && (
                                        <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                                            <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                                                <h3 className="text-lg font-bold flex items-center gap-2 text-primary"><Utensils className="h-5 w-5" /> Line Items</h3>
                                                <div className="flex items-center gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => persistDraftOrders()} disabled={isPersistingDrafts} className="bg-background font-black italic text-[10px] tracking-widest border-2">
                                                        {isPersistingDrafts ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                                        SAVE ALL DRAFTS
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {fields.length === 0 && (
                                                    <div className="text-center p-8 border-2 border-dashed rounded-xl bg-muted/20">
                                                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">No services added</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Click the button above to add an entry.</p>
                                                    </div>
                                                )}
                                                {fields.map((item, index) => {
                                                    const itemType = form.watch(`items.${index}.particularType`);
                                                    const orderId = form.watch(`items.${index}.orderId`);
                                                    const isSaved = orderId?.startsWith('ORD-');
                                                    
                                                    return (
                                                        <div key={item.id} className={cn(
                                                            "rounded-xl border p-5 transition-all duration-200 shadow-sm",
                                                            isSaved ? "bg-green-50/30 border-green-200" : "bg-muted/10"
                                                        )}>
                                                            <div className="flex justify-between items-start border-b pb-3 mb-4 border-muted-foreground/10">
                                                                <div className="font-black text-xs uppercase tracking-widest text-primary/80 flex items-center gap-2">
                                                                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">{index + 1}</div>
                                                                    Service Entry
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {isSaved ? (
                                                                        <div className="flex items-center gap-2 group/saved">
                                                                            <div className="flex flex-col items-end gap-1 scale-95 opacity-80">
                                                                                <Badge variant="outline" className="bg-green-100/50 text-green-700 border-green-200 text-[9px] font-black tracking-tighter shadow-sm py-0.5 whitespace-nowrap">EXTRACTED</Badge>
                                                                                <span className="text-[8px] text-muted-foreground/80 font-mono tracking-widest">{orderId}</span>
                                                                            </div>
                                                                            <Button 
                                                                                type="button" 
                                                                                variant="destructive" 
                                                                                size="sm" 
                                                                                onClick={async () => {
                                                                                    if (confirm('Unlink this order from this form?')) {
                                                                                        await updateOrder(orderId!, { proformaId: '' } as any);
                                                                                        remove(index);
                                                                                    }
                                                                                }} 
                                                                                className="h-8 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter px-3"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" /> UNLINK
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <Button 
                                                                                type="button" 
                                                                                variant="secondary" 
                                                                                size="sm" 
                                                                                onClick={() => persistDraftOrders(orderId)} 
                                                                                disabled={isPersistingDrafts}
                                                                                className="h-8 px-3 text-[9px] font-black bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all"
                                                                            >
                                                                                {isPersistingDrafts ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Save className="w-3 h-3 mr-1.5" />}
                                                                                SAVE DRAFT
                                                                            </Button>
                                                                            <Button 
                                                                                type="button" 
                                                                                variant="destructive" 
                                                                                size="sm" 
                                                                                onClick={() => remove(index)} 
                                                                                className="h-8 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter px-3"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" /> REMOVE
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                                                {/* First Line */}
                                                                <div className="col-span-12 md:col-span-3 lg:col-span-2 space-y-1.5">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</FormLabel>
                                                                    <FormField control={form.control} name={`items.${index}.particularType`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                                <FormControl><SelectTrigger className="h-10 text-xs font-semibold bg-background"><SelectValue /></SelectTrigger></FormControl>
                                                                                <SelectContent>
                                                                                    <SelectItem value="event">Event</SelectItem>
                                                                                    <SelectItem value="meal">Meal</SelectItem>
                                                                                    <SelectItem value="custom">Custom</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </FormItem>
                                                                    )} />
                                                                </div>
                                                                
                                                                <div className="col-span-12 md:col-span-5 lg:col-span-4 space-y-1.5">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Service Type</FormLabel>
                                                                    {itemType === 'event' && (
                                                                        <FormField control={form.control} name={`items.${index}.eventType`} render={({ field }) => (
                                                                            <FormItem>
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl><SelectTrigger className="h-10 text-xs bg-background italic"><SelectValue /></SelectTrigger></FormControl>
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
                                                                                    <FormControl><SelectTrigger className="h-10 text-xs bg-background italic"><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        {mealTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </FormItem>
                                                                        )} />
                                                                    )}
                                                                    {itemType === 'custom' && (
                                                                        <div className="flex h-10 items-center">
                                                                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest opacity-60">Ad Hoc / Free Text Layout</Badge>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-1.5">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Service Date</FormLabel>
                                                                    <FormField control={form.control} name={`items.${index}.date`} render={({ field }) => (
                                                                        <FormItem className="flex flex-col">
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <FormControl><Button variant={"outline"} className={cn("h-10 w-full justify-start text-left font-medium text-xs px-3 bg-background", !field.value && "text-muted-foreground")}>
                                                                                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                                                                        {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "dd/MM/yyyy") : <span>SELECT DATE</span>}
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
                                                                </div>

                                                                <div className="col-span-12 lg:col-span-3 lg:row-span-2 space-y-1.5">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Grand Total</FormLabel>
                                                                    <div className="h-[calc(100%-20px)] w-full rounded-xl bg-background border-2 border-dashed flex flex-col justify-center items-end p-4">
                                                                        <span className="text-secondary-foreground/60 text-xs font-bold uppercase mb-1">Item Aggregate</span>
                                                                        <span className="font-black text-2xl text-primary tracking-tighter">{form.watch(`items.${index}.total`).toLocaleString()}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Second Line */}
                                                                <div className="col-span-12 lg:col-span-3 space-y-1.5">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity (Pax)</FormLabel>
                                                                    <FormField control={form.control} name={`items.${index}.pax`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormControl><Input type="number" {...field} className="h-14 font-black text-lg bg-background" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                </div>

                                                                <div className="col-span-12 lg:col-span-3 space-y-1.5">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unit Rate (TZS)</FormLabel>
                                                                    <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormControl><Input type="number" {...field} className="h-14 font-black text-lg bg-background" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                </div>

                                                                <div className="col-span-12 lg:col-span-3 space-y-1.5">
                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Particulars / Description</FormLabel>
                                                                    <FormField control={form.control} name={`items.${index}.particularDescription`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormControl><Textarea {...field} className="min-h-[56px] h-14 bg-background font-medium resize-y py-3 text-sm border-2 focus:ring-primary/40" placeholder="E.g. Working Lunch Menu A" /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                 })}

                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    className="w-full py-10 border-dashed border-2 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 group h-auto rounded-xl" 
                                                    onClick={() => append({ 
                                                        id: `DRAFT-EVT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
                                                        orderId: `DRAFT-ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
                                                        particularType: 'event', 
                                                        eventType: eventTypes[0], 
                                                        mealType: mealTypes[0], 
                                                        pax: 1, 
                                                        unitPrice: 0, 
                                                        total: 0, 
                                                        date: format(new Date(), 'yyyy-MM-dd'), 
                                                        vatType: 'inclusive' 
                                                    })}
                                                >
                                                    <div className="flex flex-col items-center gap-2">
                                                        <PlusCircle className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                                                        <span className="text-sm font-black italic uppercase tracking-widest">Add New Service Entry</span>
                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Click to add another event or delivery item</span>
                                                    </div>
                                                </Button>
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

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                                                <FormField control={form.control} name="signedAtDate" render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel className="font-semibold">Date of Signing</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button variant="outline" className={cn("h-11 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                        {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </FormControl>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                <Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')} />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="signedAtLocation" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold">Signed At (Location)</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} className="h-11" placeholder="e.g. Dar es Salaam" />
                                                        </FormControl>
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
                                            <h2 className="text-2xl font-black italic">READY FOR FINALIZATION</h2>
                                            <p className="text-muted-foreground max-w-sm mx-auto">Please review the financial totals in the sidebar before committing this record to the ledger.</p>
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
                                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ARCHIVING...</> : <><CheckCircle className="mr-2 h-4 w-4" /> FINALIZE DOCUMENT</>}
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
                        <h3 className="font-black uppercase tracking-widest text-lg italic">Financial Summary</h3>
                        <p className="text-primary-foreground/60 text-xs font-bold mt-1 uppercase">Live Receipt View</p>
                    </div>
                    <CardContent className="p-8 space-y-8">
                        <div className="space-y-6">
                            {selectedClient ? (
                                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                    <Label className="text-[10px] uppercase font-black text-primary tracking-widest">Billed To</Label>
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
                                    <span className="text-xs font-bold text-muted-foreground uppercase">Subtotal</span>
                                    <span className="font-extrabold">{calculateSubtotal().toLocaleString()} TZS</span>
                                </div>
                                {watchedFormValues.multiplyByDays && (
                                    <div className="flex justify-between items-center text-xs p-2 rounded bg-primary/5 text-primary italic font-bold">
                                        <span>Multi-Day ({watchedFormValues.numberOfDays}d)</span>
                                        <span>× {watchedFormValues.numberOfDays}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-muted-foreground uppercase">Svc/Transp</span>
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
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Grand Payable</span>
                                        <p className="text-xs text-muted-foreground italic">Inclusive of all duties</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-black text-primary tracking-tighter">{calculateGrandTotal().toLocaleString()}</span>
                                        <span className="text-[10px] font-bold ml-1 text-primary">TZS</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col gap-2">
                                <Button variant="outline" className="w-full border-dashed border-2 font-black italic h-11" onClick={() => form.reset()}><RefreshCw className="h-4 w-4 mr-2 opacity-50" /> RESET DRAFT</Button>
                                {matchingOrders.length > 0 && (
                                    <Button variant="secondary" className="w-full font-black italic h-11 bg-primary/10 text-primary hover:bg-primary/20" onClick={() => setIsImportDialogOpen(true)}><Download className="h-4 w-4 mr-2" /> IMPORT ORDERS</Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            </div>

            {/* Sync Hub Modal */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                    <div className="bg-primary px-8 py-8 text-primary-foreground relative">
                        <Settings2 className="absolute -bottom-4 -right-4 h-32 w-32 opacity-10" />
                        <DialogTitle className="text-2xl font-black italic tracking-tight">ORDER SYNC HUB</DialogTitle>
                        <DialogDescription className="text-primary-foreground/70 font-bold uppercase text-xs mt-1">Select orders to aggregate</DialogDescription>
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
                            SYNC {selectedOrderIdsForImport.length} ORDERS
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
