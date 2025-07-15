
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Download, Loader2, Save, Edit, Pencil } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { InvoiceFormData, InvoiceItem } from '@/lib/schemas';
import type { Client } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

interface InvoicePreviewProps {
    formData: InvoiceFormData;
    client: Client | undefined;
    onDismiss: () => void;
    onSave: () => void;
    isSaving: boolean;
}

interface EditParticularsState {
    open: boolean;
    itemId: string;
    currentValue: string;
}

export function InvoicePreview({ formData, client, onDismiss, onSave, isSaving }: InvoicePreviewProps) {
    const [exporting, setExporting] = useState(false);
    const { toast } = useToast();
    const [localItems, setLocalItems] = useState<InvoiceItem[]>([]);
    const [editState, setEditState] = useState<EditParticularsState>({ open: false, itemId: '', currentValue: '' });

    useEffect(() => {
        // Initialize local item state from form data
        const initialItems = formData.items.map(item => ({
            ...item,
            // Generate the default particular description on mount if not already present
            particularDescription: item.particularDescription || getParticularText(item)
        }));
        setLocalItems(initialItems);
    }, [formData.items]);


    function getParticularText(item: InvoiceItem): string {
        if (item.particularType === 'event') {
            const eventText = item.eventType === 'Custom' ? (item.customEventType || '{EventType}') : (item.eventType || '{EventType}');
            return `${eventText}${item.date ? ` on ${formatDate(item.date)}` : ''}`;
        }
        return `${item.mealType || '{MealType}'}${item.date ? ` on ${formatDate(item.date)}` : ''}`;
    }

    const handleOpenEditDialog = (item: InvoiceItem) => {
        setEditState({
            open: true,
            itemId: item.id,
            currentValue: item.particularDescription || getParticularText(item),
        });
    };

    const handleSaveParticulars = () => {
        setLocalItems(prevItems =>
            prevItems.map(item =>
                item.id === editState.itemId
                    ? { ...item, particularDescription: editState.currentValue }
                    : item
            )
        );
        setEditState({ open: false, itemId: '', currentValue: '' });
    };

    const calculateSubtotal = () => formData.items.reduce((sum, item) => sum + item.total, 0);
    const calculateTotalDays = () => formData.multiplyByDays ? calculateSubtotal() * (formData.numberOfDays || 1) : calculateSubtotal();
    const calculateVAT = () => {
        const total = calculateTotalDays() + formData.serviceCharge + formData.transportCosts;
        return formData.vatType === 'exclusive' ? total * 0.18 : 0;
    };
    const calculateGrandTotal = () => calculateTotalDays() + formData.serviceCharge + formData.transportCosts + calculateVAT();

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
                const imgProps = pdf.getImageProperties(imgData);
                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
                pdf.save(`proforma_invoice_${formData.id || 'draft'}.pdf`);
                toast({ title: 'Success', description: 'Invoice exported as PDF.' });
            } catch (error) {
                console.error("PDF Export Error:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to export PDF.' });
            }
        }
        setExporting(false);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr || !isValid(parseISO(dateStr))) return '{Date}';
        return format(parseISO(dateStr), 'dd/MM/yyyy');
    };

    return (
      <>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-primary">Invoice Preview</h1>
              <div className="space-x-2 flex flex-wrap">
                <Button variant="outline" onClick={onDismiss} disabled={isSaving || exporting}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button onClick={onSave} disabled={isSaving || exporting}>
                  {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2" />}
                  {isSaving ? "Saving..." : "Save Invoice"}
                </Button>
                <Button variant="outline" onClick={handleExportPDF} disabled={exporting || isSaving}>
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
                    <p><strong>Date:</strong> {formatDate(formData.invoiceDate)}</p>
                    <p><strong>Pro-Forma Invoice No.:</strong> {formData.id || '{Invoice No.}'}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end mb-3">
                  <div className="flex-1">
                      <div className="text-base">
                          <p className="mb-1"><strong>To:</strong> {formData.receiverName}</p>
                          {formData.receiverPosition && <p className="mb-1 ml-6">{formData.receiverPosition}</p>}
                          {client?.companyName && <p className="mb-1 ml-6">{client.companyName}</p>}
                          {(client?.address1 || client?.address2) && <p className="mb-1 ml-6">{client.address1} {client.address2}</p>}
                          {formData.lpoNumber && <p className="mb-2 ml-6">LPO No.: {formData.lpoNumber}</p>}
                      </div>
                  </div>
                  <div style={{ width: 220 }}>
                      <div className="border border-gray-800 flex flex-col items-center justify-center text-sm p-2 bg-white shadow-sm text-center">
                          <div><strong>TIN: 151-209-696</strong></div>
                          <div><strong>VRN: 40-050290-L</strong></div>
                      </div>
                  </div>
              </div>

              <hr className="border-t-2 border-gray-800 mb-3" style={{ marginTop: '0' }} />
              
              <div className="mb-4 text-center text-lg italic p-3">
                <p>{formData.serviceDesc}</p>
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
                  {localItems.map((item, index) => (
                    <tr key={item.id}>
                      <td className="border border-gray-800 p-1.5">{index + 1}</td>
                      <td className="border border-gray-800 p-1.5">{item.pax || '{pax}'}</td>
                      <td className="border border-gray-800 p-1.5">
                        <div className="flex justify-between items-center">
                            <span>{item.particularDescription}</span>
                            <button onClick={() => handleOpenEditDialog(item)} className="p-1 text-muted-foreground hover:text-primary print:hidden">
                                <Pencil className="h-3 w-3" />
                            </button>
                        </div>
                      </td>
                      <td className="border border-gray-800 p-1.5 text-right">{item.unitPrice ? item.unitPrice.toLocaleString() : '{UnitPrice}'}</td>
                      <td className="border border-gray-800 p-1.5 text-right">{item.total ? item.total.toLocaleString() : '{Total}'}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2}></td>
                    <td className="border-r border-gray-800 p-1.5 text-right font-semibold">Sub-Total (TSHS)</td>
                    <td className="border border-gray-800 p-1.5 text-right font-semibold" colSpan={2}>{calculateSubtotal().toLocaleString()}</td>
                  </tr>
                  {formData.multiplyByDays && <tr>
                    <td colSpan={2}></td>
                    <td className="border-r border-gray-800 p-1.5 text-right">No of days</td>
                    <td className="border border-gray-800 p-1.5 text-right" colSpan={2}>{formData.numberOfDays}</td>
                  </tr>}
                  {formData.multiplyByDays && <tr>
                    <td colSpan={2}></td>
                    <td className="border-r border-gray-800 p-1.5 text-right font-semibold bg-muted">TOTAL (TSHS)</td>
                    <td className="border border-gray-800 p-1.5 text-right font-semibold bg-muted text-accent" colSpan={2}>{calculateTotalDays().toLocaleString()}</td>
                  </tr>}
                  <tr>
                    <td colSpan={2}></td>
                    <td className="border-r border-gray-800 p-1.5 text-right">Add Service Charge (TSHS)</td>
                    <td className="border border-gray-800 p-1.5 text-right" colSpan={2}>{formData.serviceCharge > 0 ? formData.serviceCharge.toLocaleString() : '0.00'}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}></td>
                    <td className="border-r border-gray-800 p-1.5 text-right">Add Transportation Costs (TSHS)</td>
                    <td className="border border-gray-800 p-1.5 text-right" colSpan={2}>{formData.transportCosts > 0 ? formData.transportCosts.toLocaleString() : '0.00'}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}></td>
                    <td className="border-r border-gray-800 p-1.5 text-right">Add VAT 18% (TSHS)</td>
                    <td className="border border-gray-800 p-1.5 text-right" colSpan={2}>{calculateVAT().toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}></td>
                    <td className="border-r border-gray-800 p-1.5 text-right font-bold bg-muted">GRAND TOTAL (TSHS)</td>
                    <td className="border border-gray-800 p-1.5 text-right font-bold bg-muted text-accent" colSpan={2}>{calculateGrandTotal().toLocaleString()}</td>
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

        <Dialog open={editState.open} onOpenChange={(isOpen) => !isOpen && setEditState({ open: false, itemId: '', currentValue: '' })}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Particulars</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="particulars-textarea" className="text-right">Description</Label>
                        <Textarea
                            id="particulars-textarea"
                            value={editState.currentValue}
                            onChange={(e) => setEditState(prev => ({ ...prev, currentValue: e.target.value }))}
                            className="col-span-3"
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSaveParticulars}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </>
    );
}
