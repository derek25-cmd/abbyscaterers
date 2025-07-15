
"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { format, isValid, parseISO } from 'date-fns';
import type { Invoice, Client } from '@/types';

interface InvoiceTemplateProps {
    invoiceData: Invoice;
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
    return format(parseISO(dateStr), 'dd/MM/yyyy');
};

export function InvoiceTemplate({ invoiceData, client }: InvoiceTemplateProps) {
    
    const { id, invoiceDate, receiverName, receiverPosition, serviceDesc, items, serviceCharge, vatType, signedAtDate, signedAtLocation } = invoiceData;

    const total = items.reduce((sum, item) => sum + item.total, 0);
    const vat = vatType === 'exclusive' ? (total + serviceCharge) * 0.18 : 0;
    const grandTotal = total + serviceCharge + vat;
    
    return (
        <Card id="invoice-pdf-content" className="p-8 bg-white text-black print:shadow-none" style={{ fontFamily: 'sans-serif' }}>
            {/* Spacer for header */}
            <div style={{ height: '100px' }}></div> 
            
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="font-bold text-4xl" style={{letterSpacing: '0.1em'}}>INVOICE</h2>
                    <div className="mt-4 text-lg">
                        <p><strong>Date:</strong> {formatDate(invoiceDate)}</p>
                        <p><strong>Invoice No.:</strong> {id || '{Invoice No.}'}</p>
                    </div>
                </div>
                <div className="text-right">
                    {/* Empty space for logo or other info if needed */}
                </div>
            </div>

            <div className="flex justify-between items-end mb-3">
              <div className="flex-1">
                  <div className="text-base">
                      <p className="mb-1"><strong>To:</strong></p>
                      {receiverName && <p className="mb-1 ml-6">{receiverName}</p>}
                      {receiverPosition && <p className="mb-1 ml-6">{receiverPosition}</p>}
                      {client?.companyName && <p className="mb-1 ml-6">{client.companyName}</p>}
                      {(client?.address1 || client?.address2) && <p className="mb-1 ml-6">{client.address1} {client.address2}</p>}
                  </div>
              </div>
              <div style={{ width: 220, position: "relative", zIndex: 10, marginBottom: '-12px' }}>
                  <div className="border border-gray-800 flex flex-col items-center justify-center text-sm p-2 bg-white shadow-sm text-center">
                      <div><strong>TIN: 151-209-696</strong></div>
                      <div><strong>VRN: 40-050290-L</strong></div>
                  </div>
              </div>
            </div>
            
            <hr className="border-t-2 border-gray-800 mb-3" />

            <div className="mb-4 text-center text-lg italic p-3">
                <p>{serviceDesc}</p>
            </div>
            
            <table className="w-full border-collapse border border-gray-800 mb-3">
                <thead>
                    <tr style={{ fontSize: '17px', fontWeight: 'bold' }}>
                        <th className="border border-gray-800 p-1 text-center w-16">S/No.</th>
                        <th className="border border-gray-800 p-1 text-center w-20">QTY</th>
                        <th className="border border-gray-800 p-1 text-left">PARTICULARS</th>
                        <th className="border border-gray-800 p-1 text-right w-40">UNIT PRICE<br/>(TSHS)</th>
                        <th className="border border-gray-800 p-1 text-right w-40">TOTAL (TSHS)</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={item.id}>
                            <td className="border border-black p-1.5 text-center">{index + 1}</td>
                            <td className="border border-black p-1.5 text-center">{item.quantity}</td>
                            <td className="border border-black p-1.5">{item.particulars}</td>
                            <td className="border border-black p-1.5 text-right">{item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="border border-black p-1.5 text-right">{item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={3} className="border-r border-black"></td>
                        <td className="border-y border-black p-1 text-right font-semibold">TOTAL (TSHS)</td>
                        <td className="border border-black p-1 text-right font-semibold">{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                        <td colSpan={3} className="border-r border-black"></td>
                        <td className="border-y border-black p-1 text-right">Add Service Charge(TSHS)</td>
                        <td className="border border-black p-1 text-right">{serviceCharge > 0 ? serviceCharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '00.00'}</td>
                    </tr>
                    <tr>
                        <td colSpan={3} className="border-r border-black"></td>
                        <td className="border-y border-black p-1 text-right">Add VAT 18% (TSHS)</td>
                        <td className="border border-black p-1 text-right">{vat > 0 ? vat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Inclusive'}</td>
                    </tr>
                    <tr>
                        <td colSpan={3} className="border-r border-black"></td>
                        <td className="border-y border-black p-1 text-right font-bold bg-secondary/40">GRAND TOTAL(TSHS)</td>
                        <td className="border border-black p-1 text-right font-bold bg-secondary/40 text-accent">{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            </table>

            <div className="my-6 text-md p-2 bg-white rounded">
                <span>Amount in Words: <span className="italic font-normal">Tanzania Shillings {convertToWords(grandTotal)}.</span></span>
            </div>

            <div className="flex justify-between items-end mt-16">
                <div className="text-sm">
                    <p>Signed at {signedAtLocation || 'Dar es Salaam'} on this {signedAtDate ? format(parseISO(signedAtDate), 'do') : '___'} day of {signedAtDate ? format(parseISO(signedAtDate), 'MMMM yyyy') : '_________ ________'}</p>
                    <p className="mt-2">For and on behalf of Abby's Legendary Caterers Limited</p>
                    <p className="mt-12">Please remit your payment to the below Bank details:</p>
                    <div className="grid grid-cols-2 gap-x-4 mt-2">
                        <div>Account Name</div><div>: ABBY'S LEGENDARY CATERERS LIMITED</div>
                        <div>Bank</div><div>: Stanbic Bank Tanzania Limited</div>
                        <div>Account Number(TZS)</div><div>: 9120002502036</div>
                        <div>Branch</div><div>: PENINSULA Branch</div>
                        <div>Branch Code</div><div>: 121009</div>
                        <div>Swift Code</div><div>: SBICTZTX</div>
                    </div>
                </div>
                <div className="text-center text-xs">
                  <img alt="Signature and Seal" className="h-24 w-auto block mx-auto mb-2" src="https://placehold.co/200x100.png" data-ai-hint="signature seal"/>
                </div>
            </div>

            <p className="text-center mt-8 p-2 bg-gray-200">We will issue EFD receipt once payment is received</p>
        </Card>
    );
}

