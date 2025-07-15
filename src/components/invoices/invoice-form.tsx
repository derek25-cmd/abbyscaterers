
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
import { CalendarIcon, Plus, Trash2, Loader2, Save } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from '../ui/textarea';

interface InvoiceFormProps {
    invoiceId?: string;
    proformaId?: string;
}

export function InvoiceForm({ invoiceId, proformaId }: InvoiceFormProps) {
    const router = useRouter();
    const { clients, isLoading: clientsLoading } = useClientStorage();
    const { getProformaById, isLoading: proformasLoading } = useProformaInvoiceStorage();
    const { getInvoiceById, addInvoice, updateInvoice, isLoading: invoicesLoading } = useInvoiceStorage();
    const { toast } = useToast();

    const isEditMode = !!invoiceId;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const form = useForm<FinalInvoiceFormData>({
        resolver: zodResolver(FinalInvoiceSchema),
        defaultValues: {
            id: "",
            proformaId: proformaId,
            invoiceDate: new Date().toISOString(),
            clientId: null,
            receiverName: '',
            receiverPosition: '',
            serviceDesc: '',
            items: [{ id: '1', particulars: '', quantity: 1, unitPrice: 0, total: 0 }],
            serviceCharge: 0,
            vatType: 'inclusive',
            signedAtDate: new Date().toISOString(),
            signedAtLocation: 'Dar es Salaam'
        }
    });
    
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    const watchedItems = form.watch("items");

    useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (name?.startsWith('items')) {
                const items = form.getValues('items');
                items.forEach((item, index) => {
                    const newTotal = (item.quantity || 0) * (item.unitPrice || 0);
                    if (item.total !== newTotal) {
                        form.setValue(`items.${index}.total`, newTotal, { shouldValidate: true });
                    }
                });
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
                    id: '',
                    proformaId: proforma.id,
                    invoiceDate: new Date().toISOString(),
                    clientId: proforma.clientId,
                    receiverName: proforma.receiverName,
                    receiverPosition: proforma.receiverPosition,
                    serviceDesc: proforma.serviceDesc,
                    items: proforma.items.map(pi => ({
                        id: pi.id,
                        particulars: pi.particularDescription || '',
                        quantity: pi.pax,
                        unitPrice: pi.unitPrice,
                        total: pi.total
                    })),
                    serviceCharge: proforma.serviceCharge,
                    vatType: proforma.vatType,
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
                    {/* Invoice & Client Details */}
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
                        <Controller name="receiverName" control={form.control} render={({ field }) => (
                            <div><Label>Receiver Name</Label><Input {...field} placeholder="Enter receiver name" /></div>
                        )}/>
                        <Controller name="receiverPosition" control={form.control} render={({ field }) => (
                            <div><Label>Receiver Position</Label><Input {...field} placeholder="Enter receiver position" /></div>
                        )}/>
                    </div>

                    {/* Service Description */}
                     <div>
                        <Label>Service Description</Label>
                        <Controller name="serviceDesc" control={form.control} render={({ field }) => <Textarea {...field} placeholder="Being costs for provision of..."/>} />
                    </div>

                    {/* Invoice Items */}
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-primary">Invoice Items</h3>
                            <Button type="button" onClick={() => append({ id: Date.now().toString(), particulars: '', quantity: 1, unitPrice: 0, total: 0 })} size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Add Item
                            </Button>
                        </div>
                        <div className="space-y-4">
                        {fields.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-8 gap-2 items-end p-2 border rounded-md">
                                <div className="md:col-span-4"><Label>Particulars</Label><Controller name={`items.${index}.particulars`} control={form.control} render={({ field }) => <Input {...field} />} /></div>
                                <div><Label>Qty</Label><Controller name={`items.${index}.quantity`} control={form.control} render={({ field }) => <Input type="number" {...field} onChange={e=>field.onChange(parseInt(e.target.value) || 0)} />} /></div>
                                <div className="md:col-span-2"><Label>Unit Price</Label><Controller name={`items.${index}.unitPrice`} control={form.control} render={({ field }) => <Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)} />} /></div>
                                <div>
                                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        ))}
                        </div>
                    </Card>

                    {/* Financials */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller name="serviceCharge" control={form.control} render={({ field }) => (
                             <div><Label>Service Charge (TSHS)</Label><Input type="number" {...field} onChange={e=>field.onChange(parseFloat(e.target.value) || 0)}/></div>
                        )}/>
                        <Controller name="vatType" control={form.control} render={({ field }) => (
                             <div><Label>VAT Type</Label>
                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="inclusive">Inclusive</SelectItem><SelectItem value="exclusive">Exclusive (+18%)</SelectItem></SelectContent>
                                </Select>
                             </div>
                         )}/>
                    </div>

                     {/* Signature Details */}
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


                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                            Preview & Save
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
