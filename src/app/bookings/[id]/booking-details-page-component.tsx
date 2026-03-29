
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import type { Booking, Order } from '@/types';
import { useBookingStorage } from "@/hooks/use-booking-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { LoadingPage } from "@/components/layout/loading-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Calendar, User, ArrowLeft, PlusCircle, FileText, ListPlus, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { DailyOrdersTable } from "@/components/bookings/daily-orders-table";
import { AddDailyOrderDialog } from "@/components/bookings/add-daily-order-dialog";
import { BulkAddOrdersDialog } from "@/components/bookings/bulk-add-orders-dialog";
import { AddBulkItemDialog } from "@/components/bookings/add-bulk-item-dialog";
import { OrderFormData, ProformaInvoiceFormData } from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { CloseBookingDialog } from "@/components/bookings/close-booking-dialog";
import { useProformaInvoiceStorage } from "@/hooks/use-proforma-invoice-storage";
import { BulkOrderLoading } from "@/components/bookings/bulk-order-loading";


export function BookingDetailsPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getBookingById, updateBooking, isLoading: bookingsLoading } = useBookingStorage();
  const { orders, getOrdersByBookingId, addOrder, updateOrder, bulkAddOrders, deleteOrder: deleteOrderFromStore, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { proformaInvoices, addProformaInvoice, updateProformaInvoice } = useProformaInvoiceStorage();

  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [bookingOrders, setBookingOrders] = useState<Order[]>([]);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isBulkItemOpen, setIsBulkItemOpen] = useState(false);
  const [isCloseBookingOpen, setIsCloseBookingOpen] = useState(false);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkCreationProgress, setBulkCreationProgress] = useState({ current: 0, total: 0 });
  
  const bookingId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    if (bookingId && !bookingsLoading && !ordersLoading) {
      const foundBooking = getBookingById(bookingId);
      if (foundBooking) {
        setBooking(foundBooking);
        setBookingOrders(getOrdersByBookingId(bookingId));
      } else {
        // router.push('/bookings'); // Redirect if not found
      }
    }
  }, [bookingId, bookingsLoading, orders, ordersLoading, getBookingById, getOrdersByBookingId, router]);

  const handleAddDailyOrder = async (orderData: Partial<OrderFormData>) => {
    if (!bookingId) return;
    try {
        const newOrder = await addOrder(orderData as OrderFormData);
        if (newOrder) {
          toast({ title: "Success", description: "Daily order has been recorded."});
          setIsAddOrderOpen(false);
           if(isBulkItemOpen) setIsBulkItemOpen(false);
          
          if (booking?.proforma_invoice_id) {
            await updateProformaWithLatestOrders();
          }
        }
    } catch(error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to record daily order."});
    }
  }

  const handleBulkAddOrders = async (bulkData: { dates: Date[], pax: number, unitPrice: number, mealType: string, vatType: 'inclusive' | 'exclusive' }) => {
    if (!bookingId || !booking) return;

    setIsBulkCreating(true);
    setBulkCreationProgress({ current: 0, total: bulkData.dates.length });
    setIsBulkAddOpen(false);

    try {
        const ordersToCreate: Partial<OrderFormData>[] = bulkData.dates.map((date) => ({
            booking_id: bookingId,
            clientEvents: [{
                clientId: booking.client_id,
                date: format(date, 'yyyy-MM-dd'),
                mealType: bulkData.mealType,
                numberOfPeople: bulkData.pax,
                unitPrice: bulkData.unitPrice,
                total: bulkData.pax * bulkData.unitPrice,
                vatType: bulkData.vatType,
                recipes: []
            }]
        }));

        const results = await bulkAddOrders(ordersToCreate);
        if (results && results.length > 0) {
            toast({ title: "Success", description: `${results.length} daily orders have been created.`});
            if (booking?.proforma_invoice_id) {
                await updateProformaWithLatestOrders();
            }
        }
    } catch(error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to create bulk orders." });
    } finally {
        setIsBulkCreating(false);
    }
  };

  const updateProformaWithLatestOrders = async () => {
    if (!booking?.proforma_invoice_id) return;
    
    const proforma = proformaInvoices.find(pi => pi.id === booking.proforma_invoice_id);
    if (!proforma) return;

    const allBookingOrders = getOrdersByBookingId(booking.id);

    const updatedItems = allBookingOrders.flatMap(order => (order.clientEvents || []).map(event => ({
        id: event.id, // Use Event ID instead of Order ID
        orderId: order.id, // Store parent Order ID for linking
        particularType: 'meal' as const,
        eventType: '',
        mealType: event.mealType,
        pax: event.numberOfPeople,
        unitPrice: event.unitPrice,
        total: event.unitPrice * event.numberOfPeople,
        date: event.date,
        vatType: event.vatType,
        particularDescription: `${event.mealType} on ${format(parseISO(event.date), 'PPP')}`
    })));

    const updatedProformaData: Partial<ProformaInvoiceFormData> = {
      items: updatedItems,
      numberOfDays: allBookingOrders.length,
    };
    
    try {
      await updateProformaInvoice(proforma.id, updatedProformaData);
      toast({ title: 'Proforma Updated', description: `Proforma Invoice ${proforma.id} has been updated with the new order.` });
    } catch (error) {
       console.error(error);
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to update proforma invoice.' });
    }
  };

  const handleDeleteDailyOrder = async (orderId: string) => {
    try {
        await deleteOrderFromStore(orderId);
        toast({ title: "Success", description: "Daily order deleted."});
        if (booking?.proforma_invoice_id) {
          await updateProformaWithLatestOrders();
        }
    } catch(error) {
         console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete daily order."});
    }
  }
  
  const getOrderTotal = (order: Order) => {
      if (!order.clientEvents || order.clientEvents.length === 0) return 0;
      const event = order.clientEvents[0];
      const total = (event.unitPrice || 0) * (event.numberOfPeople || 0);
      return total;
  }

  const bookingTotal = useMemo(() => {
    return bookingOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  }, [bookingOrders]);

  const handleCloseAndGenerateProforma = async (proformaDetails: Partial<ProformaInvoiceFormData>) => {
    if (!booking || !client) return;

    const invoiceItems = bookingOrders.flatMap(order => order.clientEvents.map(event => ({
        id: event.id, // Use Event ID instead of Order ID
        orderId: order.id, // Store parent Order ID for linking
        particularType: 'meal' as const,
        eventType: '',
        mealType: event.mealType,
        pax: event.numberOfPeople,
        unitPrice: event.unitPrice,
        total: event.unitPrice * event.numberOfPeople,
        date: event.date,
        vatType: event.vatType,
        particularDescription: `${event.mealType} on ${format(parseISO(event.date), 'PPP')}`
    })));

    const { 
        invoiceDate, 
        serviceCharge, 
        transportCosts, 
        vatType, 
        id: piId, 
        serviceDesc: pServiceDesc, 
        ...otherDetails 
    } = proformaDetails;

    const newProformaData: ProformaInvoiceFormData = {
        ...otherDetails,
        id: piId!,
        clientId: booking.client_id,
        booking_id: booking.id,
        items: invoiceItems,
        startDate: booking.start_date,
        endDate: booking.end_date,
        numberOfDays: bookingOrders.length,
        multiplyByDays: false, // Each order is a line item, so we don't multiply
        selectedEventType: 'Catering services',
        customEventType: '',
        serviceFields: {},
        invoiceDate: invoiceDate || new Date().toISOString(),
        serviceCharge: serviceCharge || 0,
        transportCosts: transportCosts || 0,
        vatType: vatType || 'inclusive',
        serviceDesc: pServiceDesc || `Catering services for ${client.companyName} from ${format(parseISO(booking.start_date), 'PPP')} to ${format(parseISO(booking.end_date), 'PPP')}`,
    };
    
    try {
        const newProforma = await addProformaInvoice(newProformaData);
        if (newProforma) {
             await updateBooking(booking.id, { proforma_invoice_id: newProforma.id });
             
             // Link all orders to the new proforma
             const orderIds = bookingOrders.map(o => o.id);
             const uniqueOrderIds = Array.from(new Set(orderIds));
                 for (const oid of uniqueOrderIds) {
                    await updateOrder(oid, { proformaId: newProforma.id } as any);
                }

             toast({ title: 'Success', description: `Proforma Invoice ${newProforma.id} created and linked to ${orderIds.length} orders.` });
             router.push(`/proforma-invoices/${newProforma.id}`);
        } else {
            throw new Error("Failed to save proforma invoice to storage.");
        }
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to create proforma invoice.' });
    }
  }

  const isLoading = bookingsLoading || clientsLoading || ordersLoading;
  
  if (isLoading) {
    return <LoadingPage title="Loading Booking Details..." />;
  }

  if (isBulkCreating) {
    return <BulkOrderLoading progress={bulkCreationProgress} />;
  }

  if (!booking) {
    return (
        <div className="text-center py-10">
            <h2 className="text-2xl font-semibold text-destructive">Booking Not Found</h2>
            <p className="text-muted-foreground mt-2">The requested booking could not be found.</p>
            <Button asChild className="mt-4"><Link href="/bookings">Back to Bookings</Link></Button>
        </div>
    );
  }
  
  const client = getClientById(booking.client_id);
  const hasProforma = !!booking.proforma_invoice_id;

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <div>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/bookings"><ArrowLeft className="mr-2 h-4 w-4" />Back to Bookings</Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{booking.name}</h1>
                <p className="text-muted-foreground">Manage daily orders for this continuous contract.</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
                 <Button variant="outline" onClick={() => setIsBulkAddOpen(true)}>
                    <ListPlus className="mr-2 h-4 w-4"/>
                    Bulk Add Orders
                </Button>
                <Button variant="outline" onClick={() => setIsBulkItemOpen(true)}>
                    <Package className="mr-2 h-4 w-4"/>
                    Add Bulk Item
                </Button>
                <Button onClick={() => setIsAddOrderOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Record Daily Order
                </Button>
                 {hasProforma ? (
                    <Button variant="outline" asChild>
                       <Link href={`/proforma-invoices/${booking.proforma_invoice_id}`}>
                          <FileText className="mr-2 h-4 w-4"/>
                          View Proforma
                       </Link>
                    </Button>
                 ) : (
                    <Button variant="default" onClick={() => setIsCloseBookingOpen(true)} disabled={bookingOrders.length === 0}>
                        <FileText className="mr-2 h-4 w-4"/>
                        Close & Generate Proforma
                    </Button>
                 )}
            </div>
       </div>

        <Card>
            <CardHeader>
                <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Client</p>
                        <p className="text-muted-foreground">{client?.companyName || 'Loading...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Contract Period</p>
                        <p className="text-muted-foreground">{format(parseISO(booking.start_date), 'PPP')} - {format(parseISO(booking.end_date), 'PPP')}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Total Billed</p>
                        <p className="text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(bookingTotal)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <DailyOrdersTable 
            data={bookingOrders} 
            onDeleteOrder={handleDeleteDailyOrder}
        />
        
        <AddDailyOrderDialog
            isOpen={isAddOrderOpen}
            setIsOpen={setIsAddOrderOpen}
            onSubmit={handleAddDailyOrder}
            bookingStartDate={booking.start_date}
            bookingEndDate={booking.end_date}
            clientId={booking.client_id}
            bookingId={booking.id}
        />

        <BulkAddOrdersDialog
            isOpen={isBulkAddOpen}
            setIsOpen={setIsBulkAddOpen}
            onSubmit={handleBulkAddOrders}
            bookingStartDate={booking.start_date}
            bookingEndDate={booking.end_date}
        />
        
        <AddBulkItemDialog
            isOpen={isBulkItemOpen}
            setIsOpen={setIsBulkItemOpen}
            onSubmit={handleAddDailyOrder}
            bookingId={booking.id}
            clientId={booking.client_id}
        />

        <CloseBookingDialog
            isOpen={isCloseBookingOpen}
            setIsOpen={setIsCloseBookingOpen}
            onSubmit={handleCloseAndGenerateProforma}
        />
    </div>
  );
}

    