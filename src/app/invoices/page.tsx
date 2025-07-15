
"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { useClientStorage } from "../../hooks/use-client-storage";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { format } from "date-fns";

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snacks", "Full Service"];

function formatTZS(amount: number): string {
  return amount.toLocaleString("en-TZ", { style: "currency", currency: "TZS" });
}

interface Client {
  id: string;
  companyName: string;
  companyEmail?: string;
  phoneNumber?: string;
  address1: string;
  address2?: string;
  primaryLocation?: string;
  lastContacted?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function InvoiceGenerator() {
  const { clients } = useClientStorage();

  const [clientSearch, setClientSearch] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [invoiceDate, setInvoiceDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [receiverName, setReceiverName] = useState<string>("");
  const [receiverPosition, setReceiverPosition] = useState<string>("");
  const [lpoNumber, setLpoNumber] = useState<string>("");
  const [mealType, setMealType] = useState<string>(mealTypes[0]);
  const [pax, setPax] = useState<number>(1);
  const [eventDate, setEventDate] = useState<string>("");
  const [eventLocation, setEventLocation] = useState<string>("");
  const [numberOfDays, setNumberOfDays] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(0);
  const [vatOption, setVatOption] = useState<string>("Inclusive");

  // Auto-fill client info on clientSearch change
  useEffect(() => {
    if (!clientSearch) {
      setSelectedClient(null);
      return;
    }
    const found = clients.find(
      (c) =>
        c.id.toLowerCase() === clientSearch.toLowerCase() ||
        c.companyName.toLowerCase().includes(clientSearch.toLowerCase())
    );
    setSelectedClient(found || null);
  }, [clientSearch, clients]);

  // Calculations
  const subtotal = pax * unitPrice * numberOfDays;
  const serviceCharge = (subtotal * serviceChargePercent) / 100;
  const vatRate = vatOption === "Exclusive" ? 0.18 : 0;
  const vatAmount = (subtotal + serviceCharge) * vatRate;
  const total = subtotal + serviceCharge + vatAmount;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Proforma Invoice Generator</h1>
      <form className="space-y-4">
        <div>
          <label>Client ID or Name</label>
          <Input
            value={clientSearch}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setClientSearch(e.target.value)}
            placeholder="Enter client ID or name"
          />
        </div>
        {selectedClient && (
          <div className="p-4 border rounded bg-gray-50">
            <p><strong>Client Name:</strong> {selectedClient.companyName}</p>
            <p><strong>Address:</strong> {selectedClient.address1} {selectedClient.address2}</p>
            <p><strong>Contact:</strong> {selectedClient.phoneNumber}</p>
          </div>
        )}
        <div>
          <label>Date of Invoice</label>
          <Input
            type="date"
            value={invoiceDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setInvoiceDate(e.target.value)}
          />
        </div>
        <div>
          <label>Invoice Number</label>
          <Input
            value={invoiceNumber}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setInvoiceNumber(e.target.value)}
            placeholder="Enter invoice number"
          />
        </div>
        <div>
          <label>Name of Invoice Receiver</label>
          <Input
            value={receiverName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReceiverName(e.target.value)}
            placeholder="Enter receiver name"
          />
        </div>
        <div>
          <label>Position of Invoice Receiver</label>
          <Input
            value={receiverPosition}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReceiverPosition(e.target.value)}
            placeholder="Enter receiver position"
          />
        </div>
        <div>
          <label>LPO Number</label>
          <Input
            value={lpoNumber}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLpoNumber(e.target.value)}
            placeholder="Enter LPO number"
          />
        </div>
        <div>
          <label>Meal Type</label>
          <Select
            value={mealType}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setMealType(e.target.value)}
          >
            {mealTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        </div>
        <div>
          <label>Pax</label>
          <Input
            type="number"
            min={1}
            value={pax}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPax(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Date of Event</label>
          <Input
            type="date"
            value={eventDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEventDate(e.target.value)}
          />
        </div>
        <div>
          <label>Event Location</label>
          <Input
            value={eventLocation}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEventLocation(e.target.value)}
            placeholder="Enter event location"
          />
        </div>
        <div>
          <label>Number of Days</label>
          <Input
            type="number"
            min={1}
            value={numberOfDays}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNumberOfDays(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Unit Price</label>
          <Input
            type="number"
            min={0}
            value={unitPrice}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUnitPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <label>Service Charge (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={serviceChargePercent}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setServiceChargePercent(Number(e.target.value))}
          />
        </div>
        <div>
          <label>VAT Options</label>
          <Select
            value={vatOption}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setVatOption(e.target.value)}
          >
            <option value="Inclusive">Inclusive (0%)</option>
            <option value="Exclusive">Exclusive (18%)</option>
          </Select>
        </div>
        <div className="p-4 bg-gray-100 rounded">
          <p><strong>Subtotal:</strong> {formatTZS(subtotal)}</p>
          <p><strong>Service Charge:</strong> {formatTZS(serviceCharge)}</p>
          <p><strong>VAT:</strong> {formatTZS(vatAmount)}</p>
          <p><strong>Total:</strong> {formatTZS(total)}</p>
        </div>
        <div>
          <Button type="button" onClick={() => alert("Export to PDF not implemented yet")}>
            Export as PDF
          </Button>
          <Button type="button" onClick={() => alert("Export as Email-ready HTML not implemented yet")}>
            Export as Email-ready HTML
          </Button>
          <Button type="button" onClick={() => alert("Print not implemented yet")}>
            Print
          </Button>
        </div>
      </form>
    </div>
  );
}
