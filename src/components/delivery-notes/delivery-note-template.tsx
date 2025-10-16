
"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { format, isValid, parseISO } from 'date-fns';
import type { DeliveryNote, Client } from '@/types';
import { useSettingsStorage } from '@/hooks/use-settings-storage';
import Image from 'next/image';

interface DeliveryNoteTemplateProps {
    deliveryNote: DeliveryNote;
    client: Client | undefined;
}

const formatDate = (dateStr?: string) => {
    if (!dateStr || !isValid(parseISO(dateStr))) return '{Date}';
    return format(parseISO(dateStr), 'do MMMM yyyy');
};

export function DeliveryNoteTemplate({ deliveryNote, client }: DeliveryNoteTemplateProps) {
    const { settings } = useSettingsStorage();
    const { id, deliveryDate, clientName, deliveryLocation, vehicleRegNo, deliveredBy, items } = deliveryNote;
    
    const totalRows = 23;
    const filledItems = items.map((item, index) => ({
        s_n: index + 1,
        qty: item.qty,
        itemCode: item.itemCode,
        description: item.description,
    }));
    
    // Create empty rows to reach the total of 23
    const emptyRows = Array.from({ length: Math.max(0, totalRows - filledItems.length) }, (_, index) => ({
        s_n: filledItems.length + index + 1,
        qty: '',
        itemCode: '',
        description: '',
    }));
    
    const displayItems = [...filledItems, ...emptyRows];

    return (
        <Card
            id="delivery-note-pdf-content"
            className="p-8 bg-white text-black print:shadow-none"
            style={{ fontFamily: 'sans-serif', fontSize: '12px' }}
        >
            {settings.headerUrl && <Image src={settings.headerUrl} alt="Header" layout="responsive" width={700} height={100} />}

            <div className="flex justify-between items-start mt-4 mb-4">
                <div className="text-sm">
                    <p><strong>Account No.</strong> {client?.id || 'N/A'}</p>
                    <p><strong>Customer Name:</strong> {clientName}</p>
                    <p><strong>Delivery Address:</strong> {deliveryLocation}</p>
                    <p><strong>Vehicle Reg. No.</strong> {vehicleRegNo || 'N/A'}</p>
                </div>
                <div className="text-right text-sm">
                    <h2 className="font-bold text-2xl text-primary mb-1">DELIVERY NOTE No. {id}</h2>
                    <p><strong>Date:</strong> {formatDate(deliveryDate)}</p>
                </div>
            </div>

            <div className="mb-2">
                <p>Please Receive the Following/bellow Goods/Items:</p>
            </div>
            
            <div className="flex justify-end mb-2">
                <div className="border border-gray-800 flex flex-col items-center justify-center text-xs p-1 bg-white shadow-sm text-center w-40">
                    <div><strong>TIN: 151-209-696</strong></div>
                    <div><strong>VRN: 40-050290-L</strong></div>
                </div>
            </div>

            <table className="w-full border-collapse border border-gray-800 text-xs mb-2">
                <thead>
                    <tr className="font-bold text-center bg-gray-200">
                        <th className="border border-gray-800 p-1 w-[5%]">S/N</th>
                        <th className="border border-gray-800 p-1 w-[10%]">QTY</th>
                        <th className="border border-gray-800 p-1 w-[15%]">ITEM CODE</th>
                        <th className="border border-gray-800 p-1 text-left">DESCRIPTION OF ITEMS DELIVERED</th>
                    </tr>
                </thead>
                <tbody>
                    {displayItems.map((item, index) => (
                        <tr key={index}>
                            <td className="border border-gray-800 p-1 text-center">{item.s_n}</td>
                            <td className="border border-gray-800 p-1 text-center">{item.qty}</td>
                            <td className="border border-gray-800 p-1 text-center">{item.itemCode}</td>
                            <td className="border border-gray-800 p-1">{item.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="text-xs space-y-2 mt-4">
                <p><strong>Note:</strong> All shortages must be indicated on the signed copy of this delivery Note at the time of delivery. Any claim not indicated on this signed copy will NOT be accepted.</p>
                <p className="font-bold">THE SUPPLIER HAS DELIVERED THE ABOVE GOODS IN THE RIGHT QUANTITY, GOOD ORDER AND CONDITION and THE CUSTOMER HAVE RECEIVED THE ABOVE GOODS IN THE RIGHT QUANTITY, GOOD ORDER AND CONDITION.</p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
                <div>
                    <p>Delivered By: <strong>{deliveredBy || '_________________________'}</strong></p>
                    <p className="mt-8">Signature: _________________________</p>
                    <p className="mt-8">Date: {formatDate(deliveryDate)}</p>
                </div>
                <div className="text-left">
                    <p>Received By: _________________________</p>
                     <p className="mt-8">Signature: _________________________</p>
                    <p className="mt-8">Designation: _________________________</p>
                </div>
            </div>
        </Card>
    );
}
