
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Trash2, Eye, Download, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { useClientStorage } from '@/hooks/use-client-storage';
import type { Client } from '@/types';

interface InvoiceItem {
  id: string;
  eventType: string;
  customEventType?: string;
  mealType: string;
  pax: number;
  unitPrice: number;
  total: number;
  date?: Date;
  particularType: 'event' | 'meal';
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

const defaultServiceFields = {
  eventType: true,
  mealType: true,
  pax: true,
  numberOfDays: true,
  startDate: true,
  endDate: true,
  location: true
};

const buildServiceDesc = (
  serviceFields: Record<string, boolean>,
  items: InvoiceItem[],
  numberOfDays: number,
  startDate?: Date,
  endDate?: Date,
  location?: string,
  eventType?: string,
  customEventType?: string
) => {
  let desc = 'Provision of';
  if (serviceFields.eventType && (eventType || customEventType)) {
    desc += ` ${eventType === 'Custom' ? customEventType : eventType}`;
  }
  if (serviceFields.mealType && items[0]?.mealType) desc += ` ${items[0].mealType}`;
  if (serviceFields.pax) desc += ` to ${items.reduce((sum, item) => sum + item.pax, 0) || '{pax}'}`;
  if (serviceFields.numberOfDays) desc += ` # day for ${numberOfDays || '{No. of days}'}`;
  if (serviceFields.startDate && startDate) desc += ` from ${format(startDate, 'dd/MM/yyyy')}`;
  if (serviceFields.endDate && endDate) desc += ` to ${format(endDate, 'dd/MM/yyyy')}`;
  if (serviceFields.location && location) desc += ` at ${location}`;
  return desc;
};

export default function ProformaInvoiceGenerator() {
  const [invoiceDate, setInvoiceDate] = useState<Date>();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPosition, setReceiverPosition] = useState('');
  const [lpoNumber, setLpoNumber] = useState('');
  const [location, setLocation] = useState('');
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [multiplyByDays, setMultiplyByDays] = useState(true);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [transportCosts, setTransportCosts] = useState(0);
  const [vatType, setVatType] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  // Event type for service description
  const [selectedEventType, setSelectedEventType] = useState(eventTypes[0]);
  const [customEventType, setCustomEventType] = useState('');
  // Dates
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  // Service description fields
  const [serviceFields, setServiceFields] = useState<{ [key: string]: boolean }>({ ...defaultServiceFields });
  const [serviceDesc, setServiceDesc] = useState('');
  // Invoice Items
  const [items, setItems] = useState<InvoiceItem[]>([{
    id: '1',
    eventType: eventTypes[0],
    customEventType: '',
    mealType: '',
    pax: 0,
    unitPrice: 0,
    total: 0,
    date: undefined,
    particularType: 'event' as 'event' | 'meal'
  }]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (startDate && endDate && endDate >= startDate) {
      const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setNumberOfDays(Math.max(1, diff));
    } else if (startDate && !endDate) {
      setNumberOfDays(1);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setServiceDesc(buildServiceDesc(
      serviceFields,
      items,
      numberOfDays,
      startDate,
      endDate,
      location,
      selectedEventType,
      customEventType
    ));
    // eslint-disable-next-line
  }, [serviceFields, items, numberOfDays, startDate, endDate, location, selectedEventType, customEventType]);

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      eventType: selectedEventType,
      customEventType: selectedEventType === 'Custom' ? customEventType : '',
      mealType: '',
      pax: 0,
      unitPrice: 0,
      total: 0,
      date: startDate,
      particularType: 'event' as 'event' | 'meal'
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = {
          ...item,
          [field]: value
        };
        if (field === 'pax' || field === 'unitPrice') {
          updatedItem.total = updatedItem.pax * updatedItem.unitPrice;
        }
        if (field === 'eventType' && value !== 'Custom') {
          updatedItem.customEventType = undefined;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + item.total, 0);
  const calculateTotalDays = () => multiplyByDays ? calculateSubtotal() * numberOfDays : calculateSubtotal();
  const calculateVAT = () => {
    const totalDays = calculateTotalDays();
    const total = totalDays + serviceCharge + transportCosts;
    return vatType === 'exclusive' ? total * 0.18 : 0;
  };
  const calculateGrandTotal = () => calculateTotalDays() + serviceCharge + transportCosts + calculateVAT();

  const convertToWords = (amount: number): string => {
    if (amount < 0) return 'Negative amounts are not supported';
    if (amount === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const thousands = ['', 'Thousand', 'Million', 'Billion'];
    function convertChunk(num: number): string {
      let result = '';
      if (num >= 100) {
        result += ones[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      if (num >= 20) {
        result += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      } else if (num >= 10) {
        result += teens[num - 10] + ' ';
        return result.trim();
      }
      if (num > 0) {
        result += ones[num] + ' ';
      }
      return result.trim();
    }
    let numStr = Math.floor(amount).toString();
    let chunkCount = 0;
    let result = '';
    while (numStr.length > 0) {
      let chunk = numStr.slice(-3);
      numStr = numStr.slice(0, -3);
      let chunkNum = parseInt(chunk);
      if (chunkNum !== 0) {
        let chunkWords = convertChunk(chunkNum);
        if (chunkCount > 0) {
          chunkWords += ' ' + thousands[chunkCount];
        }
        result = chunkWords + ' ' + result;
      }
      chunkCount++;
    }
    return result.trim();
  };

 const handleExportPDF = async () => {
    setExporting(true);
    const invoiceNode = document.getElementById('invoice-pdf-content');
    if (invoiceNode) {
      try {
        const canvas = await html2canvas(invoiceNode, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = 210;
        const pdfHeight = 297;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`proforma_invoice_${invoiceNumber || 'draft'}.pdf`);
        toast({ title: 'Success', description: 'Invoice exported as PDF.' });
      } catch (error) {
        console.error("PDF Export Error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to export PDF.' });
      }
    }
    setExporting(false);
  };

  if (showPreview) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-primary">Invoice Preview</h1>
            <div className="space-x-2 flex flex-wrap">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                <Eye className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button variant="outline" onClick={handleExportPDF} disabled={exporting}>
                {exporting ? <Loader2 className="animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2" />}
                {exporting ? "Exporting..." : "Export PDF"}
              </Button>
            </div>
          </div>
          <Card id="invoice-pdf-content" className="p-8 bg-white text-black print:shadow-none" style={{ fontFamily: 'sans-serif', position: 'relative', paddingBottom: '80px' }}>
             {/* HEADER SECTION */}
            <div className="flex justify-between items-start mb-6 relative">
              <div className="flex-1"></div>
              <div className="text-right">
                <h2 className="font-bold text-4xl text-primary">PROFORMA INVOICE</h2>
                <div className="mt-3 text-lg">
                  <p><strong>Date:</strong> {invoiceDate ? format(invoiceDate, 'dd/MM/yyyy') : '{Date}'}</p>
                  <p><strong>Pro-Forma Invoice No.:</strong> {invoiceNumber || '{Invoice No.}'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="text-base">
                  {receiverName && <p className="mb-1"><strong>To:</strong> {receiverName}</p>}
                  {receiverPosition && <p className="mb-1 ml-6">{receiverPosition}</p>}
                  {selectedClient?.companyName && <p className="mb-1 ml-6">{selectedClient.companyName}</p>}
                  {(selectedClient?.address1 || selectedClient?.address2) && <p className="mb-1 ml-6">{selectedClient.address1} {selectedClient.address2}</p>}
                  {lpoNumber && <p className="mb-2 ml-6">LPO No.: {lpoNumber}</p>}
                </div>
              </div>
              <div style={{ width: 220, position: 'relative', zIndex: 2, marginBottom: '-18px' }}>
                <div className="border border-gray-800 flex flex-col items-center justify-center text-sm p-2 bg-white shadow-sm text-center">
                  <div><strong>TIN: 151-209-696</strong></div>
                  <div><strong>VRN: 40-050290-L</strong></div>
                </div>
              </div>
            </div>
            <hr className="border-t border-gray-800 mb-3" style={{ marginTop: '0', position: 'relative', zIndex: 1 }} />
            
            <div className="mb-4 text-center text-lg italic p-3">
              <p>{serviceDesc}</p>
            </div>

            <table className="w-full border-collapse border border-gray-800 mb-3 text-sm">
              <thead>
                <tr className="font-bold">
                  <th className="border border-gray-800 p-1.5 text-left w-12">S/No.</th>
                  <th className="border border-gray-800 p-1.5 text-left w-16">QTY</th>
                  <th className="border border-gray-800 p-1.5 text-left">PARTICULARS</th>
                  <th className="border border-gray-800 p-1.5 text-right w-36">UNIT PRICE (TSHS)</th>
                  <th className="border border-gray-800 p-1.5 text-right w-32">TOTAL (TSHS)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border border-gray-800 p-1.5">{index + 1}</td>
                    <td className="border border-gray-800 p-1.5">{item.pax || '{pax}'}</td>
                    <td className="border border-gray-800 p-1.5">
                      {item.particularType === 'event'
                        ? `${item.eventType === 'Custom' ? (item.customEventType || '{EventType}') : (item.eventType || '{EventType}')}${item.date ? ` on ${format(item.date, 'dd/MM/yyyy')}` : ''}`
                        : `${item.mealType || '{MealType}'}${item.date ? ` on ${format(item.date, 'dd/MM/yyyy')}` : ''}`
                      }
                    </td>
                    <td className="border border-gray-800 p-1.5 text-right">{item.unitPrice ? item.unitPrice.toLocaleString() : '{UnitPrice}'}</td>
                    <td className="border border-gray-800 p-1.5 text-right">{item.total ? item.total.toLocaleString() : '{Total}'}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} />
                  <td className="border border-gray-800 p-1.5 text-right font-semibold">Sub-Total (TSHS)</td>
                  <td className="border border-gray-800 p-1.5 text-right font-semibold">{calculateSubtotal().toLocaleString()}</td>
                </tr>
                <tr>
                  <td colSpan={3} />
                  <td className="border border-gray-800 p-1.5 text-right">No of days</td>
                  <td className="border border-gray-800 p-1.5 text-right">{numberOfDays}</td>
                </tr>
                <tr>
                  <td colSpan={3} />
                  <td className="border border-gray-800 p-1.5 text-right font-semibold bg-muted">TOTAL (TSHS)</td>
                  <td className="border border-gray-800 p-1.5 text-right font-semibold bg-muted text-accent">{calculateTotalDays().toLocaleString()}</td>
                </tr>
                <tr>
                  <td colSpan={3} />
                  <td className="border border-gray-800 p-1.5 text-right">Add Service Charge (TSHS)</td>
                  <td className="border border-gray-800 p-1.5 text-right">{serviceCharge > 0 ? serviceCharge.toLocaleString() : '0.00'}</td>
                </tr>
                <tr>
                  <td colSpan={3} />
                  <td className="border border-gray-800 p-1.5 text-right">Add Transportation Costs (TSHS)</td>
                  <td className="border border-gray-800 p-1.5 text-right">{transportCosts > 0 ? transportCosts.toLocaleString() : '0.00'}</td>
                </tr>
                <tr>
                  <td colSpan={3} />
                  <td className="border border-gray-800 p-1.5 text-right">Add VAT 18% (TSHS)</td>
                  <td className="border border-gray-800 p-1.5 text-right">{calculateVAT().toLocaleString()}</td>
                </tr>
                <tr>
                  <td colSpan={3} />
                  <td className="border border-gray-800 p-1.5 text-right font-bold bg-muted">GRAND TOTAL (TSHS)</td>
                  <td className="border border-gray-800 p-1.5 text-right font-bold bg-muted text-accent">{calculateGrandTotal().toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <div className="mb-6 text-center text-md font-bold p-2 bg-white rounded">
              <span>Amount in Words: <span className="italic font-normal">Tanzania Shillings {convertToWords(calculateGrandTotal())}.</span></span>
            </div>

            <div className="flex justify-end mb-6">
              <div className="text-center text-xs">
                <p className="mb-1">For and on behalf of:-</p>
                <p className="mb-2 font-semibold">Abby's Legendary Caterers Limited</p>
                <img alt="Signature and Seal" className="h-20 w-auto block mx-auto mb-2" src="https://placehold.co/200x80.png" data-ai-hint="signature seal"/>
                <p>Signature: ___________________</p>
              </div>
            </div>

            <div className="text-sm">
              <p className="font-bold mb-1">Terms & Conditions:</p>
              <ul className="space-y-0.5 list-disc list-inside text-xs">
                <li>Purchaser's LPO or Company Purchase Order Letter must be issued.</li>
                <li>Payments shall be by Bank transfer or by Cheque.</li>
                <li>Unless otherwise agreed in writing, payments shall be made within 14 days after the invoice date.</li>
                <li>This Quote/Pro-Forma Invoice is Valid for 30days only.</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // --- ENTRY FORM ---
  return (
    <div className="min-h-screen p-6">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Proforma Invoice Generator</CardTitle>
          <CardDescription>Fill in the details below to create a new proforma invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <Card className="p-6">
              <CardTitle className="text-xl mb-4">Invoice Details</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="invoice-date">Invoice Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !invoiceDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {invoiceDate ? format(invoiceDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={invoiceDate} onSelect={setInvoiceDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="invoice-number">Invoice Number</Label>
                  <Input id="invoice-number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g., PI-2024-001" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <CardTitle className="text-xl mb-4">Client Information</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="client">Select Client</Label>
                  <Select onValueChange={value => setSelectedClient(clients.find(c => c.id === value) || null)} disabled={clientsLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select a client"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.companyName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lpo-number">LPO Number</Label>
                  <Input id="lpo-number" value={lpoNumber} onChange={e => setLpoNumber(e.target.value)} placeholder="Enter LPO number" />
                </div>
                 <div>
                  <Label htmlFor="receiver-name">Receiver Name</Label>
                  <Input id="receiver-name" value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Enter receiver name" />
                </div>
                <div>
                  <Label htmlFor="receiver-position">Receiver Position</Label>
                  <Input id="receiver-position" value={receiverPosition} onChange={e => setReceiverPosition(e.target.value)} placeholder="Enter receiver position" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <CardTitle className="text-xl mb-4">Event Details</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                   <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => startDate ? date < startDate : false} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Enter event location" />
                </div>
                <div>
                  <Label htmlFor="days">Number of Days</Label>
                  <Input id="days" type="number" min="1" value={numberOfDays} onChange={e => setNumberOfDays(parseInt(e.target.value, 10) || 1)} />
                </div>
                <div className="flex items-center space-x-2 mt-2 col-span-full">
                  <Checkbox id="multiply-days" checked={multiplyByDays} onCheckedChange={checked => setMultiplyByDays(checked as boolean)} />
                  <Label htmlFor="multiply-days">Multiply item totals by number of days</Label>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <CardTitle className="text-xl mb-4">Service Description</CardTitle>
               <div className="space-y-4">
                <div>
                  <Label>Event Type for Description</Label>
                  <Select value={selectedEventType} onValueChange={value => setSelectedEventType(value)}>
                    <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                    <SelectContent>{eventTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select>
                  {selectedEventType === 'Custom' && (<Input placeholder="Custom Event Type" value={customEventType} onChange={e => setCustomEventType(e.target.value)} className="mt-2" />)}
                </div>
                <div>
                  <Label className="block">Customize Service Description Fields</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    {serviceFieldsList.map(field => (
                      <div key={field.key} className="flex items-center space-x-2">
                        <Checkbox checked={serviceFields[field.key]} onCheckedChange={checked => setServiceFields(prev => ({...prev, [field.key]: checked as boolean}))} id={`service-field-${field.key}`} />
                        <Label htmlFor={`service-field-${field.key}`}>{field.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mt-4 block">Service Description Preview</Label>
                  <textarea className="w-full border rounded p-2 mt-1 bg-muted/50" rows={3} value={serviceDesc} onChange={e => setServiceDesc(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
               <div className="flex justify-between items-center mb-6">
                <CardTitle className="text-xl">Invoice Items</CardTitle>
                <Button onClick={addItem} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </Button>
              </div>
              <div className="space-y-6">
                {items.map((item, index) => (
                  <Card key={item.id} className="p-6 border-l-4 border-l-primary bg-card">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-lg font-semibold text-primary">Item #{index + 1}</h4>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} disabled={items.length === 1} className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Show in Particulars</Label>
                        <Select value={item.particularType} onValueChange={value => updateItem(item.id, 'particularType', value)}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent><SelectItem value="event">Event Type</SelectItem><SelectItem value="meal">Meal Type</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Event Type</Label>
                        <Select value={item.eventType} onValueChange={value => updateItem(item.id, 'eventType', value)}>
                          <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                          <SelectContent>{eventTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                        </Select>
                        {item.eventType === 'Custom' && (<Input placeholder="Custom Event Type" value={item.customEventType || ''} onChange={e => updateItem(item.id, 'customEventType', e.target.value)} className="mt-2" />)}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Meal Type</Label>
                        <Select value={item.mealType} onValueChange={value => updateItem(item.id, 'mealType', value)}>
                          <SelectTrigger><SelectValue placeholder="Select meal type" /></SelectTrigger>
                          <SelectContent>{mealTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !item.date && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {item.date ? format(item.date, "PPP") : <span>Pick date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={item.date} onSelect={date => updateItem(item.id, 'date', date)} disabled={date => (startDate && date < startDate) || (endDate && date > endDate)} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>Pax</Label><Input type="number" min="0" value={item.pax} onChange={e => updateItem(item.id, 'pax', parseInt(e.target.value) || 0)} /></div>
                      <div className="space-y-2"><Label>Unit Price (TSHS)</Label><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} /></div>
                      <div className="space-y-2"><Label>Total (TSHS)</Label><Input type="number" value={item.total} readOnly className="bg-muted/50 font-semibold" /></div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <CardTitle className="text-xl mb-4">Additional Charges & Summary</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="service-charge">Service Charge (TSHS)</Label>
                  <Input id="service-charge" type="number" min="0" step="0.01" value={serviceCharge} onChange={e => setServiceCharge(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label htmlFor="transport-costs">Transport Costs (TSHS)</Label>
                  <Input id="transport-costs" type="number" min="0" step="0.01" value={transportCosts} onChange={e => setTransportCosts(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label htmlFor="vat-type">VAT Type</Label>
                  <Select value={vatType} onValueChange={(value: 'inclusive' | 'exclusive') => setVatType(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="inclusive">Inclusive (0%)</SelectItem><SelectItem value="exclusive">Exclusive (+18%)</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-8 p-4 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between"><span>Subtotal:</span><span>{calculateSubtotal().toLocaleString()} TSHS</span></div>
                    {multiplyByDays && (<div className="flex justify-between"><span>Subtotal × Days:</span><span>{calculateTotalDays().toLocaleString()} TSHS</span></div>)}
                    <div className="flex justify-between"><span>Service Charge:</span><span>{serviceCharge.toLocaleString()} TSHS</span></div>
                    <div className="flex justify-between"><span>Transport:</span><span>{transportCosts.toLocaleString()} TSHS</span></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span>VAT ({vatType === 'exclusive' ? '18%' : '0%'}):</span><span>{calculateVAT().toLocaleString()} TSHS</span></div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-1"><span>Grand Total:</span><span className="text-accent">{calculateGrandTotal().toLocaleString()} TSHS</span></div>
                  </div>
                </div>
              </div>
            </Card>
            
            <div className="mt-8 flex justify-end">
              <Button onClick={() => setShowPreview(true)}>
                <Eye className="w-4 h-4 mr-2" /> Preview Invoice
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    