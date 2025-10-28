"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { format, isValid, parseISO } from "date-fns";
import type { DeliveryNote, Client } from "@/types";
import { useSettingsStorage } from "@/hooks/use-settings-storage";
import Image from "next/image";

interface DeliveryNoteTemplateProps {
  deliveryNote: DeliveryNote;
  client: Client | undefined;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr || !isValid(parseISO(dateStr))) return "{Date}";
  return format(parseISO(dateStr), "do MMMM yyyy");
};

export function DeliveryNoteTemplate({
  deliveryNote,
  client,
}: DeliveryNoteTemplateProps) {
  const { settings } = useSettingsStorage();
  const {
    id,
    delivery_date,
    client_name,
    delivery_location,
    vehicle_reg_no,
    delivered_by,
    items,
    client_id,
  } = deliveryNote;

  const totalRows = 20;

  // ✅ Dynamic numbering — only actual items are numbered
  const filledItems = items.map((item, index) => ({
    s_n: index + 1,
    qty: item.qty,
    itemCode: item.itemCode,
    description: item.description,
  }));

  const emptyRows = Array.from(
    { length: Math.max(0, totalRows - filledItems.length) },
    () => ({
      s_n: "", // 👈 empty placeholder rows have no S/N
      qty: "",
      itemCode: "",
      description: "",
    })
  );

  const displayItems = [...filledItems, ...emptyRows];

  return (
    <Card
      id="delivery-note-pdf-content"
      className="p-8 bg-white text-black print:shadow-none"
      style={{
        fontFamily: "sans-serif",
        fontSize: "20px",
        position: "relative",
        marginRight: "14px", // ✅ Slightly reduced width
      }}
    >
      {/* Header */}
      <div id="invoice-header">
        {settings.headerUrl && (
          <Image
            src={settings.headerUrl}
            alt="Header"
            layout="responsive"
            width={700}
            height={100}
          />
        )}
      </div>

      {/* DELIVERY NOTE HEADING */}
      <div
        className="text-right relative z-10"
        style={{ transform: "translateY(-20px)" }}
      >
        <h2 className="font-bold text-2xl text-primary mb-1">
          DELIVERY NOTE No. {id}
        </h2>
      </div>

      {/* CLIENT DETAILS + DATE */}
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div
          className="text-lg w-1/2"
          style={{
            fontSize: "18px",
            lineHeight: "1.4rem",
          }}
        >
          <div>
            <p>
              <strong>Account No.</strong> {client_id || "N/A"}
            </p>

            {/* ✅ Customer Name with flexible layout */}
            <p style={{ display: "flex" }}>
              <strong style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                Customer Name:&nbsp;
              </strong>
              <span style={{ wordBreak: "break-word" }}>{client_name}</span>
            </p>

            {/* ✅ Address with same wrapping style */}
            <p style={{ display: "flex" }}>
              <strong style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                Delivery Address:&nbsp;
              </strong>
              <span style={{ wordBreak: "break-word" }}>
                {delivery_location}
              </span>
            </p>

            <p>
              <strong>By Vehicle Reg. No.</strong> {vehicle_reg_no || "N/A"}
            </p>
          </div>
        </div>

        <div
          className="text-right w-1/2"
          style={{ transform: "translateY(-24px)" }}
        >
          <p>
            <strong>Date:</strong> {formatDate(delivery_date)}
          </p>
        </div>
      </div>

      {/* TABLE TITLE */}
      <div
        className="text-center font-semibold"
        style={{ transform: "translateY(-5px)", marginBottom: "1px" }}
      >
        <p>Please Receive the Following/below Goods/Items:</p>
      </div>

      {/* TIN/VRN BOX */}
      <div className="relative mt-0">
        <div
          className="absolute"
          style={{
            transform: "translateY(-47px)",
            right: "0px",
          }}
        >
          <div
            className="flex flex-col items-center justify-center p-1 bg-white text-center w-40 border border-gray-800 h-[3rem]"
            style={{
              fontSize: "14px",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: "1.1rem",
            }}
          >
            <div>
              <strong>TIN: 151-209-696</strong>
            </div>
            <div>
              <strong>VRN: 40-050290-L</strong>
            </div>
          </div>
        </div>

        
        {/* TABLE */}
<table
  className="w-full border-collapse border border-gray-800 text-sm mb-0"
  style={{ tableLayout: 'fixed' }}
>
  <thead>
    <tr className="font-bold text-center bg-gray-200">
      <th className="border border-gray-800 p-[0.25rem] w-[5%]">S/N</th>
      <th className="border border-gray-800 p-[0.25rem] w-[10%]">QTY</th>
      <th className="border border-gray-800 p-[0.25rem] w-[14%]">ITEM CODE</th>
      <th className="border border-gray-800 p-[0.25rem] text-left">
        DESCRIPTION OF ITEMS DELIVERED
      </th>
    </tr>
  </thead>
  <tbody>
    {displayItems.map((item, index) => (
      <tr
        key={index}
        style={{
          height: '24px', // ✅ ensures every row (empty or filled) has equal height
        }}
      >
        <td
          className="border border-gray-800 p-[0.25rem] text-center align-middle"
          style={{ verticalAlign: 'middle' }}
        >
          {item.qty ? item.s_n : ''} {/* ✅ number only for filled rows */}
        </td>
        <td className="border border-gray-800 p-[0.25rem] text-center align-middle">
          {item.qty}
        </td>
        <td className="border border-gray-800 p-[0.25rem] text-center align-middle">
          {item.itemCode}
        </td>
        <td className="border border-gray-800 p-[0.25rem] align-middle">
          {item.description}
        </td>
      </tr>
    ))}
  </tbody>
</table>

      </div>

      {/* NOTE */}
      <div className="text-xs mt-0">
        <p className="font-bold mt-0 mb-0">Note:</p>
        <p className="mt-0 mb-2">
          All shortages must be indicated on the signed copy of this delivery
          note at the time of delivery. Any claim not indicated on this signed
          copy will NOT be accepted.
        </p>
        <p className="font-bold mt-0 text-center align-middle">
          THE SUPPLIER HAS DELIVERED THE ABOVE GOODS IN THE RIGHT QUANTITY, GOOD
          ORDER AND CONDITION and 
        </p>
        <p className= "font-bold mt-0 text-center align-middle">
        THE CUSTOMER HAVE RECEIVED THE ABOVE GOODS IN THE RIGHT QUANTITY, GOOD ORDER AND CONDITION.
        </p>
      </div>

      {/* SIGNATURE SECTION */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p>
            Delivered By:{" "}
            <strong>{delivered_by || "_________________________"}</strong>
          </p>
          <p className="mt-4" style={{ transform : 'translateY(15px)'}}>Signature: _________________________</p>
          <p className="mt-4" style={{ transform : 'translateY(15px)'}}>Date: {formatDate(delivery_date)}</p>
        </div>

        <div className="text-left">
          <p>Received By: _________________________</p>
          <p className="mt-4" style={{ transform : 'translateY(15px)'}}>Signature: _________________________</p>
          <p className="mt-4" style={{ transform : 'translateY(15px)'}}>Designation: _________________________</p>
        </div>
      </div>
      {/* FOOTER */}
      <div
  className="w-full mt-12 text-center"
  style={{
    paddingTop: '8px',
    fontSize: '12px',
    transform: 'translateY(-27px)',
  }}
>
  <p
    style={{
      fontWeight: 'bold',
      letterSpacing: '1px',
      marginBottom: '6px',
    }}
  >
    ABBY'S LEGENDARY CATERERS LIMITED
  </p>

  <div
    className="flex justify-between text-left mt-1"
    style={{ gap: '1rem', fontSize: '11px' }}
  >
    <div style={{ flex: 1 , transform: 'translateX(0px)' }}>
      <p>
        <strong>DAR ES SALAAM</strong><br />
        Plot # 362 Makenya Street,<br />
        Regent Estate - Mikocheni<br />
        P.O. Box 25187, Dar es Salaam
      </p>
    </div>
    <div
      style={{
        width: '1px',
        backgroundColor: '#000',
        height: '100%',
        alignSelf: 'stretch',
        margin: '0 4px',
      }}
    />
    <div style={{ flex: 1, transform: 'translateX(0px)'}}>
      <p>
        <strong>DODOMA</strong><br />
        Area “A” Kizota,<br />
        Off Singida Road<br />
        P.O. Box 3317, Dodoma
      </p>
    </div>
    <div
      style={{
        width: '1px',
        backgroundColor: '#000',
        height: '100%',
        alignSelf: 'stretch',
        margin: '0 4px',
      }}
    />
    <div style={{ flex: 1, transform: 'translateX(0px)' }}>
      <p>
        <strong>ARUSHA</strong><br />
        House No. 228, Olosiva Street,<br />
        Sakina kwa Iddi<br />
        P.O. Box 10632, Arusha
      </p>
    </div>
    <div
      style={{
        width: '1px',
        backgroundColor: '#000',
        margin: '0 10px',
        height: '100%', // make it fill the parent’s height
        alignSelf: 'stretch', 
      }}
    />

    <div style={{ flex: 1, transform: 'translateX(0px)'}}>
      <p>
        <strong>Mobile:</strong>+255795110200 / 764447335<br />
        <strong>Email:</strong> abbys.caterers@gmail.com<br />
        <strong>Orders:</strong> orders@abbys.co.tz<br />
        <strong>Web:</strong> www.abbys.co.tz
      </p>
    </div>
  </div>
</div>

    </Card>
  );
}
