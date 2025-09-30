
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, isValid, parseISO } from 'date-fns';
import type { ProformaInvoice, Client, InvoiceItem } from '@/types';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useSettingsStorage } from '@/hooks/use-settings-storage';
import Image from 'next/image';


interface ProformaInvoiceTemplateProps {
    invoiceData: ProformaInvoice;
    client: Client | undefined;
}

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

const formatDate = (dateStr?: string) => {
    if (!dateStr || !isValid(parseISO(dateStr))) return '{Date}';
    return format(parseISO(dateStr), 'do MMMM yyyy');
};

interface EditParticularsState {
    open: boolean;
    itemId: string;
    currentValue: string;
}


export function ProformaInvoiceTemplate({ invoiceData, client }: ProformaInvoiceTemplateProps) {
    
    const [localItems, setLocalItems] = useState(invoiceData.items);
    const [notes, setNotes] = useState("");
    const [editState, setEditState] = useState<EditParticularsState>({ open: false, itemId: '', currentValue: '' });
    const { settings } = useSettingsStorage();
    
    const getParticularText = (item: InvoiceItem): string => {
        if (item.particularType === 'event') {
            const eventText = item.eventType === 'Custom' ? (item.customEventType || '{EventType}') : (item.eventType || '{EventType}');
            return `${eventText}${item.date ? ` on ${format(parseISO(item.date), 'PPP')}` : ''}`;
        }
        return `${item.mealType || '{MealType}'}${item.date ? ` on ${format(parseISO(item.date), 'PPP')}` : ''}`;
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

    const { id, invoiceDate, receiverName, receiverPosition, lpoNumber, serviceDesc, serviceCharge, transportCosts, multiplyByDays, numberOfDays, vatType } = invoiceData;

    const subtotal = localItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalForDays = multiplyByDays ? subtotal * (numberOfDays || 1) : subtotal;
    const totalBeforeVAT = totalForDays + (serviceCharge || 0) + (transportCosts || 0);
    const vat = vatType === 'exclusive' ? totalBeforeVAT * 0.18 : 0;
    const grandTotal = totalBeforeVAT + vat;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    }
    
    return (
        <>
            <div style={{ marginLeft: '1cm' , marginRight: '0.8cm' }}>
                                
            <Card
                id="proforma-invoice-pdf-content"
                className="p-8 bg-white text-black print:shadow-none"
                style={{
                    fontFamily: 'sans-serif',
                    minHeight: '297mm',
                    fontSize: '15px',
                    position: 'relative'
                }}
            >
                 <div className="absolute top-8 left-8 right-8 flex justify-center items-start">
                    {settings.headerUrl && <Image src={settings.headerUrl} alt="Header" width={500} height={100} />}
                </div>

                <div className="flex flex-col h-full pt-32">
                    {/* HEADER SECTION */}
                    <div className="flex justify-end items-start mb-2 relative">
                        <div className="text-right">
                        <h2 className="font-bold text-4xl text-primary">PROFORMA INVOICE</h2>
                        <div className="mt-1 text-base space-y-0">
                            <p><strong>Date:</strong> {formatDate(invoiceDate)}</p>
                            <p><strong>Pro-Forma Invoice No.:</strong> {id || '{Invoice No.}'}</p>
                        </div>
                        </div>
                    </div>

                                        <div className="flex justify-between items-end mb-1">
                        <div className="flex-1">
                            <div className="text-base">
                                <p className="mb-1"><strong>To:</strong></p>
                                {receiverName && <p className="mb-1 ml-6">{receiverName}</p>}
                                {receiverPosition && <p className="mb-1 ml-6">{receiverPosition}</p>}
                                {client?.companyName && <p className="mb-1 ml-6">{client.companyName}</p>}
                                {client?.address1 && <p className="mb-1 ml-6">{client.address1}</p>}
                                {client?.address2 && <p className="mb-1 ml-6">{client.address2}</p>}
                                {lpoNumber && <p className="mb-2 ml-6 pt-2 font-bold text-lg">LPO No.: {lpoNumber}</p>}
                            </div>
                        </div>
                        <div style={{ width: 220, position: "relative", zIndex: 10, marginBottom: '-5px' }}>
                            <div className="border border-gray-800 flex flex-col items-center justify-center text-sm p-2 bg-white shadow-sm text-center">
                                <div><strong>TIN: 151-209-696</strong></div>
                                <div><strong>VRN: 40-050290-L</strong></div>
                            </div>
                        </div>
                    </div>
                    <hr className="border-t-2 border-gray-800" />
                    
                    <div className="my-2 text-center text-base italic p-1" style={{minHeight: '1cm'}}>
                        <p>{serviceDesc}</p>
                    </div>
                    <table className="w-full border-collapse border border-gray-800 text-sm" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ fontWeight: 'bold' }} className="text-center bg-gray-200">
                                <th className="border border-gray-800 p-1" style={{ width: '5%' }}>S/No.</th>
                                <th className="border border-gray-800 p-1" style={{ width: '5%' }}>QTY</th>
                                <th className="border border-gray-800 p-1" style={{ width: '10%' }}>Order ID</th>
                                <th className="border border-gray-800 p-1 text-left" style={{ width: '40%' }}>PARTICULARS</th>
                                <th className="border border-gray-800 p-1 text-right" style={{ width: '25%' }}>UNIT PRICE (TSHS)</th>
                                <th className="border border-gray-800 p-1 text-right" style={{ width: '15%' }}>TOTAL (TSHS)</th>
                            </tr>
                        </thead>
                         <tbody>
                            {localItems.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="border border-black p-1 text-center">{index + 1}</td>
                                    <td className="border border-black p-1 text-center">{item.pax || '{pax}'}</td>
                                    <td className="border border-black p-1 text-center font-mono text-xs">{item.id}</td>
                                    <td className="border border-black p-1 text-left">
                                        <div className="flex justify-between items-center">
                                            <span>{item.particularDescription || getParticularText(item)}</span>
                                            <button onClick={() => handleOpenEditDialog(item)} className="p-1 text-muted-foreground hover:text-primary print:hidden">
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="border border-black p-1 text-right">{item.unitPrice ? formatCurrency(item.unitPrice) : '{UnitPrice}'}</td>
                                    <td className="border border-black p-1 text-right">{item.total ? formatCurrency(item.total) : '{Total}'}</td>
                                </tr>
                            ))}
                            {/* Summary Rows Start Here */}
                             <tr>
                                <td colSpan={4} rowSpan={8} className="p-1 align-center border-t-2 border-x-2 border-b-2 border-black">
                                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes concerning the order..." className="h-full w-full border-none resize-none text-center bg-transparent focus-visible:ring-0 p-1"/>
                                </td>
                                <td className="p-1 text-right font-semibold border-t-2 border-b border-l border-black border-r border black">Sub-Total (TSHS)</td>
                                <td className="p-1 text-right font-semibold border-t-2 border-b border-r border-black">{formatCurrency(subtotal)}</td>
                            </tr>
                            {multiplyByDays && (
                                <>
                                <tr>
                                    <td className="p-1 text-right border-b border-l border-black border-r border black">No of days</td>
                                    <td className="p-1 text-right border-b border-r border-black">{numberOfDays || 1}</td>
                                </tr>
                                <tr>
                                    <td className="p-1 text-right font-bold bg-secondary/20 border-b border-l border-black border-r border black">TOTAL (TSHS)</td>
                                    <td className="p-1 text-right font-bold bg-secondary/20 border-b border-r border-black">{formatCurrency(totalForDays)}</td>
                                </tr>
                                </>
                            )}
                            <tr>
                                <td className="p-1 text-right border-b border-l border-black border-r border black">Add Service Charge (TSHS)</td>
                                <td className="p-1 text-right border-b border-r border-black">{serviceCharge > 0 ? formatCurrency(serviceCharge) : '0.00'}</td>
                            </tr>
                            <tr>
                                <td className="p-1 text-right border-b border-l border-black border-r border black">Add Transportation Costs (TSHS)</td>
                                <td className="p-1 text-right border-b border-r border-black">{transportCosts > 0 ? formatCurrency(transportCosts) : '0.00'}</td>
                            </tr>
                            <tr>
                                <td className="p-1 text-right border-b border-l border-black border-r border black">Total Before VAT (TSHS)</td>
                                <td className="p-1 text-right border-b border-r border-black">{formatCurrency(totalBeforeVAT)}</td>
                            </tr>
                            <tr>
                                <td className="p-1 text-right border-b border-l border-black border-r border black">Add VAT 18% (TSHS)</td>
                                <td className="p-1 text-right border-b border-r border-black">{vat > 0 ? formatCurrency(vat) : 'Inclusive'}</td>
                            </tr>
                            <tr>
                                <td className="p-1 text-right font-bold bg-secondary/40 border-b border-l border-black border-r border black">GRAND TOTAL (TSHS)</td>
                                <td className="p-1 text-right font-bold bg-secondary/40 border-b border-r border-black text-accent">{formatCurrency(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="mb-4 text-base p-2 bg-white rounded">
                        <span className="font-bold">Amount in Words:</span> <span className="italic">Tanzania Shillings {convertToWords(grandTotal)} only.</span>
                    </div>
                    
                    <div className="flex-grow"></div>
                    
                    <div className="footer-sections" style={{ breakBefore: 'page', pageBreakBefore: 'always', marginBottom: '40px' }}>
                      <div className="flex justify-end mb-4">
                          <div className="text-center" style={{ fontSize: '14px' }}>
                          <p className="mb-1">For and on behalf of:-</p>
                          <p className="mb-2 font-semibold" style={{ fontSize: '14px' }}>Abby's Legendary Caterers Limited</p>
                          <img alt="Signature and Seal" className="h-20 w-auto block mx-auto mb-2" src="https://placehold.co/200x80.png" data-ai-hint="signature seal"/>
                          <p className="mb-1" style={{ fontSize: '14px' }}>Signature: ___________________</p>
                          </div>
                      </div>
                      <div className="text-sm">
                          <p className="font-bold mb-1" style={{ fontSize: '14px' }}>Terms & Conditions:</p>
                          <ul className="space-y-1 list-disc list-inside" style={{ fontFamily:'monospace', fontSize: '14px' }}>
                          <li>Purchaser's LPO or Company Purchase Order Letter must be issued.</li>
                          <li>Payments shall be by Bank transfer or by Cheque.</li>
                          <li>Unless otherwise agreed in writing, payments shall be made within 14 days after the invoice date.</li>
                          <li>This Quote/Pro-Forma Invoice is Valid for 30days only.</li>
                          </ul>
                      </div>
                    </div>
                </div>
                 {settings.footerUrl && (
                    <div className="absolute bottom-8 left-8 right-8">
                        <Image src={settings.footerUrl} alt="Footer" layout="responsive" width={700} height={100} />
                    </div>
                 )}
              </Card>
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
