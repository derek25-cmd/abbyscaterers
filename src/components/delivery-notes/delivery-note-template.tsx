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
    const { id, delivery_date, client_name, delivery_location, vehicle_reg_no, delivered_by, items, client_id } = deliveryNote;
    
    const totalRows = 20;
    const filledItems = items.map((item, index) => ({
        s_n: index + 1,
        qty: item.qty,
        itemCode: item.itemCode,
        description: item.description,
    }));
    
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
            style={{ fontFamily: 'sans-serif', fontSize: '20px', position: 'relative' }}
        >
             <div id="invoice-header">
                {settings.headerUrl && <Image src={settings.headerUrl} alt="Header" layout="responsive" width={700} height={100} />}
             </div>
            
            <div className="flex justify-between items-start mt-[-2.5rem] mb-4 relative z-10">
                <div className="text-sm w-1/2">
                    {/* Placeholder for left side content */}
                </div>
                <div className="text-right w-1/2">
                    <h2 className="font-bold text-2xl text-primary mb-1">DELIVERY NOTE No. {id}</h2>
                    <p><strong>Date:</strong> {formatDate(delivery_date)}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-2 mt-[-1rem]">
                <div className="text-lg" style={{fontSize: '23px'}}>
                    <p><strong>Account No.</strong> {client_id || 'N/A'}</p>
                    <p><strong>Customer Name:</strong> {client_name}</p>
                    <p><strong>Delivery Address:</strong> {delivery_location}</p>
                    <p><strong>Vehicle Reg. No.</strong> {vehicle_reg_no || 'N/A'}</p>
                </div>
            </div>

            <div className="mb-2 text-center font-semibold">
                <p>Please Receive the Following/bellow Goods/Items:</p>
            </div>

            <div className="relative mt-6">
                {/* Box positioned at top-left, aligned with table border */}
                <div className="absolute -top-[2.6rem] -left-[1px]">
                    <div className="flex flex-col items-center justify-center text-xs p-1 bg-white text-center w-40 border border-gray-800">
                    <div><strong>TIN: 151-209-696</strong></div>
                    <div><strong>VRN: 40-050290-L</strong></div>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border border-gray-800 text-sm mb-2">
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
            </div>
            
            <div className="text-xs space-y-2 mt-4">
                <p><strong>Note:</strong> All shortages must be indicated on the signed copy of this delivery Note at the time of delivery. Any claim not indicated on this signed copy will NOT be accepted.</p>
                <p className="font-bold">THE SUPPLIER HAS DELIVERED THE ABOVE GOODS IN THE RIGHT QUANTITY, GOOD ORDER AND CONDITION and THE CUSTOMER HAVE RECEIVED THE ABOVE GOODS IN THE RIGHT QUANTITY, GOOD ORDER AND CONDITION.</p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
                <div>
                    <p>Delivered By: <strong>{delivered_by || '_________________________'}</strong></p>
                    <p className="mt-8">Signature: _________________________</p>
                    <p className="mt-8">Date: {formatDate(delivery_date)}</p>
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
