
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
import { CalendarIcon, Plus, Trash2, Loader2, Save, Eye, ChevronsUpDown, Check, Settings2, User, Info, FileText, CheckCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isValid, parseISO, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useProformaInvoiceStorage } from '@/hooks/use-proforma-invoice-storage';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { ProformaInvoiceSchema, type ProformaInvoiceFormData } from '@/lib/schemas';
import { ProformaInvoiceTemplate } from './proforma-invoice-template';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';


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

export function ProformaInvoiceForm({ invoiceId, clientId }: ProformaInvoiceFormProps) {
    const router = useRouter();
    const { clients, isLoading: clientsLoading } = useClientStorage();
    const { getProformaById, addProformaInvoice, updateProformaInvoice } = useProformaInvoiceStorage();
    const { orders, addOrder } = useOrderStorage();
    const { toast } = useToast();

    const isEditMode = !!invoiceId;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(['item-0']);

    const form = useForm<ProformaInvoiceFormData>({
        resolver: zodResolver(ProformaInvoiceSchema),
        defaultValues: {
            id: "",
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
            items: [{ id: Date.now().toString(), particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: new Date().toISOString(), vatType: 'inclusive' }],
        }
    });
    
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    
    const watchedFormValues = form.watch();

    const handleSaveAndCreateOrder = (itemIndex: number) => {
        const itemData = form.getValues(`items.${itemIndex}`);
        const client_id = form.getValues('clientId');

        if (!client_id) {
            toast({
                variant: "destructive",
                title: "Client Not Selected",
                description: "Please select a client before creating an order."
            });
            return;
        }

        try {
            const orderData = {
                id: itemData.id || `ORD-${Date.now()}`,
                name: `Order for ${itemData.eventType} on ${format(parseISO(itemData.date!), 'PPP')}`,
                clientEvents: [{
                    clientId: client_id,
                    date: itemData.date || new Date().toISOString(),
                    numberOfPeople: itemData.pax,
                    mealType: itemData.mealType,
                    unitPrice: itemData.unitPrice,
                    vatType: itemData.vatType,
                    recipes: [],
                }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            addOrder(orderData as any); 

            toast({
                title: "Order Created",
                description: `Order ${orderData.id} has been saved.`,
            });
            setOpenAccordionItems([]); // Collapse the current item
        } catch (error) {
            console.error("Failed to create order:", error);
            let message = "An error occurred while saving the order.";
            if (error instanceof Error) message = error.message;
            toast({
                variant: "destructive",
                title: "Failed to Create Order",
                description: message,
            });
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
        if (serviceFields.startDate && startDate) desc += ` from ${format(parseISO(startDate), 'dd/MM/yyyy')}`;
        if (serviceFields.endDate && endDate) desc += ` to ${format(parseISO(endDate), 'dd/MM/yyyy')}`;
        if (serviceFields.location && location) desc += ` at ${location}`;
        return desc;
    }, [form]);
    
    useEffect(() => {
        form.setValue("serviceDesc", buildServiceDesc());
    }, [watchedFormValues.serviceFields, watchedFormValues.items, watchedFormValues.numberOfDays, watchedFormValues.startDate, watchedFormValues.endDate, watchedFormValues.location, watchedFormValues.selectedEventType, watchedFormValues.customEventType, buildServiceDesc, form]);

    useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
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
                            form.setValue(`items.${index}.particularDescription`, `${item.eventType} on ${format(parseISO(item.date!), 'PPP')}`)
                        } else {
                            form.setValue(`items.${index}.particularDescription`, `${item.mealType} on ${format(parseISO(item.date!), 'PPP')}`)
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
            const existingInvoice = getProformaById(invoiceId);
            if (existingInvoice) form.reset(existingInvoice);
        }
    }, [isEditMode, invoiceId, getProformaById, form]);

    async function handleSave(data: ProformaInvoiceFormData) {
        setIsSubmitting(true);
        try {
            if (isEditMode && invoiceId) {
                updateProformaInvoice(invoiceId, data);
                toast({ title: 'Success', description: 'Proforma invoice updated successfully.' });
                router.push(`/proforma-invoices/${data.id}`);
            } else {
                const newInvoice = addProformaInvoice(data);
                toast({ title: 'Success', description: 'Proforma invoice created successfully.' });
                router.push(`/proforma-invoices/${newInvoice.id}`);
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


    if (showPreview) {
        const formData = form.getValues();
        const selectedClient = clients.find(c => c.id === formData.clientId);
        return (
            <div>
                 <div className="flex justify-end gap-4 mb-4">
                    <Button type="button" variant="outline" onClick={() => setShowPreview(false)}>Back to Edit</Button>
                    <Button type="button" onClick={form.handleSubmit(handleSave)} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                        {isEditMode ? 'Update Proforma' : 'Save Proforma'}
                    </Button>
                </div>
                <ProformaInvoiceTemplate invoiceData={formData} client={selectedClient}/>
            </div>
        )
    }

    return (
        <Card className="max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-3xl font-bold text-primary">{isEditMode ? "Edit Proforma Invoice" : "Create New Proforma Invoice"}</CardTitle>
                <CardDescription>Fill in the details for the proforma invoice.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(() => setShowPreview(true))} className="space-y-6">
                    <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger className="text-lg font-semibold"><Info className="mr-2 h-5 w-5 text-primary" />Invoice Details</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Controller name="id" control={form.control} render={({ field }) => (
                                    <div><Label>Proforma Invoice Number</Label><Input {...field} placeholder="e.g., PI-2024-001" /></div>
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


                    {/* Order Items */}
                    <Card className="p-4 border-primary/20">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-primary flex items-center"><FileText className="mr-2 h-5 w-5"/>Order Items</h3>
                            <Button type="button" onClick={() => { 
                                const newIndex = fields.length;
                                append({ id: Date.now().toString(), particularType: 'event', eventType: eventTypes[0], mealType: mealTypes[0], pax: 1, unitPrice: 0, total: 0, date: new Date().toISOString(), vatType: 'inclusive' });
                                setOpenAccordionItems([`item-${newIndex}`]);
                             }} size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Add Item
                            </Button>
                        </div>
                        <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-2">
                            {fields.map((item, index) => {
                                const orderId = form.getValues(`items.${index}.id`);
                                const isSaved = orders.some(o => o.id === orderId);
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
                                            <div><Label>Order ID</Label><Controller name={`items.${index}.id`} control={form.control} render={({ field }) => <Input {...field} />} /></div>
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
                                            <Button type="button" variant="outline" size="sm" onClick={() => handleSaveAndCreateOrder(index)}><Save className="h-4 w-4 mr-2" />Save as Order</Button>
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
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Eye className="w-5 h-5 mr-2" />}
                            Preview Proforma
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
