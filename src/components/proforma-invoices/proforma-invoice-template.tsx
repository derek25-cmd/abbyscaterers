
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
    showHeaders?: boolean;
    preserveSpace?: boolean;
    showFooterOnly?: boolean;
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


export function ProformaInvoiceTemplate({ invoiceData, client, showHeaders = true, preserveSpace = false, showFooterOnly = false }: ProformaInvoiceTemplateProps) {
    
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

    // Custom entries mode: when unlinked custom rows exist alongside order-linked
    // entries, show only the custom rows (and derive totals from them).
    const showingCustom = React.useMemo(
        () => localItems.some(item => !item.orderId) && localItems.some(item => !!item.orderId),
        [localItems]
    );

    const sortedItems = React.useMemo(() => {
        const itemsToDisplay = showingCustom
            ? localItems.filter(item => !item.orderId)
            : localItems;
        return [...itemsToDisplay].sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return parseISO(a.date).getTime() - parseISO(b.date).getTime();
        });
    }, [localItems, showingCustom]);

    const subtotal = sortedItems.reduce((sum, item) => sum + (item.total || 0), 0);
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
                className={`${showHeaders ? 'p-8' : 'px-8 pb-10 pt-2'} bg-white text-black print:shadow-none`}
                style={{
                    fontFamily: 'sans-serif',
                    fontSize: '15px',
                }}
            >
                <div id="proforma-header" style={{
                    display: (showHeaders || preserveSpace) ? 'block' : 'none',
                    visibility: showHeaders ? 'visible' : 'hidden'
                }}>
                    {settings.headerUrl && <Image src={settings.headerUrl} alt="Header" layout="responsive" width={700} height={100} />}
                </div>

                <div id="proforma-main-content">
                    {/* Title overlaps the header by exactly 4px */}
                    <div className="text-right relative z-10" style={{ marginTop: showHeaders ? '-4px' : '0' }}>
                        <h2 className="font-bold text-4xl text-primary">PROFORMA INVOICE</h2>
                        <div className="mt-1 text-base space-y-0">
                            <p><strong>Date:</strong> {formatDate(invoiceDate)}</p>
                            <p><strong>Pro-Forma Invoice No.:</strong> {id || '{Invoice No.}'}</p>
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
                        <div style={{ width: 220, position: "relative", zIndex: 10, marginBottom: '0' }}>
                            <div className="border border-gray-800 flex flex-col items-center justify-center text-sm p-2 bg-white shadow-sm text-center">
                                <div><strong>TIN: 151-209-696</strong></div>
                                <div><strong>VRN: 40-050290-L</strong></div>
                            </div>
                        </div>
                    </div>
                    <hr className="border-t-2 border-gray-800" style={{ marginTop: '5px' }} />
                    {/* No top margin/padding — content sits flush under the hr */}
                    <div className="mb-1 text-center text-base italic px-4" style={{ marginTop: 0, paddingTop: '2px', paddingBottom: '2px' }}>
                        <p>{serviceDesc}</p>
                    </div>

                    <table className="w-full border-collapse border border-gray-800 text-sm" style={{ tableLayout: 'fixed', borderWidth: '1px' }}>
                        <thead>
                            <tr style={{ fontWeight: 'bold' }} className="text-center bg-gray-200">
                                <th className="border border-gray-800 py-1 px-1" style={{ width: '5%', borderWidth: '1px' }}>S/No.</th>
                                <th className="border border-gray-800 py-1 px-1" style={{ width: '5%', borderWidth: '1px' }}>QTY</th>
                                {!showingCustom && (
                                    <th className="border border-gray-800 py-1 px-1" style={{ width: '10%', borderWidth: '1px' }}>Order ID</th>
                                )}
                                <th className="border border-gray-800 py-1 px-2 text-left" style={{ width: showingCustom ? '50%' : '40%', borderWidth: '1px' }}>PARTICULARS</th>
                                <th className="border border-gray-800 py-1 px-2 text-right" style={{ width: '25%', borderWidth: '1px' }}>UNIT PRICE (TSHS)</th>
                                <th className="border border-gray-800 py-1 px-2 text-right" style={{ width: '15%', borderWidth: '1px' }}>TOTAL (TSHS)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedItems.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="border border-black py-1 px-1 text-center" style={{borderWidth: '1px'}}>{index + 1}</td>
                                    <td className="border border-black py-1 px-1 text-center" style={{borderWidth: '1px'}}>{item.pax || '{pax}'}</td>
                                    {!showingCustom && (
                                        <td className="border border-black py-1 px-1 text-center font-mono text-xs" style={{borderWidth: '1px'}}>{item.id}</td>
                                    )}
                                    <td className="border border-black py-1 px-2 text-left" style={{borderWidth: '1px'}}>
                                        <div className="flex justify-between items-start gap-1">
                                            <span className="leading-snug">{item.particularDescription || getParticularText(item)}</span>
                                            <button onClick={() => handleOpenEditDialog(item)} className="p-1 text-muted-foreground hover:text-primary print:hidden shrink-0">
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="border border-black py-1 px-2 text-right" style={{borderWidth: '1px'}}>{item.unitPrice ? formatCurrency(item.unitPrice) : '{UnitPrice}'}</td>
                                    <td className="border border-black py-1 px-2 text-right" style={{borderWidth: '1px'}}>{item.total ? formatCurrency(item.total) : '{Total}'}</td>
                                </tr>
                            ))}
                            {/* Summary Rows Start Here */}
                            <tr>
                                <td colSpan={showingCustom ? 3 : 4} rowSpan={8} className="p-2 align-top border" style={{borderWidth: '1px'}}>
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Notes concerning the order..."
                                        className="min-h-[100px] h-full w-full border-none resize-none bg-transparent focus-visible:ring-0 p-1 text-sm"
                                    />
                                </td>
                                <td className="py-1 px-2 text-right font-semibold border" style={{borderWidth: '1px'}}>Sub-Total (TSHS)</td>
                                <td className="py-1 px-2 text-right font-semibold border" style={{borderWidth: '1px'}}>{formatCurrency(subtotal)}</td>
                            </tr>
                            {multiplyByDays && (
                                <>
                                <tr>
                                    <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>No of days</td>
                                    <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>{numberOfDays || 1}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 px-2 text-right font-bold bg-secondary/20 border" style={{borderWidth: '1px'}}>TOTAL (TSHS)</td>
                                    <td className="py-1 px-2 text-right font-bold bg-secondary/20 border" style={{borderWidth: '1px'}}>{formatCurrency(totalForDays)}</td>
                                </tr>
                                </>
                            )}
                            <tr>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>Add Service Charge (TSHS)</td>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>{serviceCharge > 0 ? formatCurrency(serviceCharge) : '0.00'}</td>
                            </tr>
                            <tr>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>Add Transportation Costs (TSHS)</td>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>{transportCosts > 0 ? formatCurrency(transportCosts) : '0.00'}</td>
                            </tr>
                            <tr>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>Total Before VAT (TSHS)</td>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>{formatCurrency(totalBeforeVAT)}</td>
                            </tr>
                            <tr>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>Add VAT 18% (TSHS)</td>
                                <td className="py-1 px-2 text-right border" style={{borderWidth: '1px'}}>{vat > 0 ? formatCurrency(vat) : 'Inclusive'}</td>
                            </tr>
                            <tr>
                                <td className="py-1 px-2 text-right font-bold bg-secondary/40 border" style={{borderWidth: '1px'}}>GRAND TOTAL (TSHS)</td>
                                <td className="py-1 px-2 text-right font-bold bg-secondary/40 text-accent border" style={{borderWidth: '1px'}}>{formatCurrency(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div data-pdf-no-break="true" className="text-right mb-2 text-base px-2 pb-2 bg-white rounded">
                        <span className="font-bold">Amount in Words:</span> <span className="italic">Tanzania Shillings {convertToWords(grandTotal)} only.</span>
                    </div>

                    <div data-pdf-no-break="true" className="flex gap-4 mt-6 mb-4 items-stretch">
                        <div className="flex-1 border border-gray-800 p-3" style={{ fontSize: '14px' }}>
                            <p className="font-bold mb-1" style={{ fontSize: '14px' }}>Terms &amp; Conditions:</p>
                            <div style={{ fontSize: '14px', margin: 0 }}>
                                {[
                                    "Purchaser's LPO or Company Purchase Order Letter must be issued.",
                                    "Payments shall be by Bank transfer or by Cheque.",
                                    "Unless otherwise agreed in writing, payments shall be made within 14 days after the invoice date.",
                                    "This Quote/Pro-Forma Invoice is Valid for 30days only.",
                                ].map((text, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: i < 3 ? '4px' : 0 }}>
                                        <span style={{ flexShrink: 0, lineHeight: '1.4' }}>•</span>
                                        <span style={{ lineHeight: '1.4' }}>{text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="border border-gray-800 p-3 text-center" style={{ fontSize: '14px', minWidth: '220px', position: 'relative' }}>
                            {settings.proformaStampUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt="Stamp" src={settings.proformaStampUrl} style={{ position: 'absolute', bottom: '18px', right: '4px', width: '120px', height: '120px', objectFit: 'contain', mixBlendMode: 'multiply', zIndex: 10 }} />
                            )}
                            <p className="mb-1">For and on behalf of:-</p>
                            <p className="mb-1 font-semibold" style={{ fontSize: '14px' }}>Abby&apos;s Legendary Caterers Limited</p>
                            {settings.signatureUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt="Signature" src={settings.signatureUrl} className="block mx-auto" style={{ maxWidth: '100%', maxHeight: '65px', width: 'auto', height: 'auto', mixBlendMode: 'multiply', position: 'relative', zIndex: 2 }} />
                            )}
                            <p style={{ marginTop: settings.signatureUrl ? '-10px' : '30px', fontSize: '14px', position: 'relative', zIndex: 1 }}>Signature: ___________________</p>
                        </div>
                    </div>
                </div>
                
                 <div id="proforma-footer" className="pb-6" style={{
                    display: (showHeaders || preserveSpace || showFooterOnly) ? 'block' : 'none',
                    visibility: showHeaders ? 'visible' : 'hidden'
                 }}>
                      {settings.footerUrl && (
                        <div className="mt-4">
                            <Image src={settings.footerUrl} alt="Footer" layout="responsive" width={700} height={100} />
                        </div>
                    )}
                 </div>
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
