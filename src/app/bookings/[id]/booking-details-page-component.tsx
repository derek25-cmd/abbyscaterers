
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
import { Calendar, User, ArrowLeft, PlusCircle, FileCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { DailyOrdersTable } from "@/components/bookings/daily-orders-table";
import { AddDailyOrderDialog } from "@/components/bookings/add-daily-order-dialog";
import { OrderFormData, FinalInvoiceFormData } from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { CloseBookingDialog } from "@/components/bookings/close-booking-dialog";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";


export function BookingDetailsPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getBookingById, isLoading: bookingsLoading } = useBookingStorage();
  const { orders, getOrdersByBookingId, addOrder, deleteOrder: deleteOrderFromStore, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { addInvoice } = useInvoiceStorage();

  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [bookingOrders, setBookingOrders] = useState<Order[]>([]);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isCloseBookingOpen, setIsCloseBookingOpen] = useState(false);
  
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
        await addOrder(orderData);
        toast({ title: "Success", description: "Daily order has been recorded."});
        setIsAddOrderOpen(false); // Close dialog on success
    } catch(error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to record daily order."});
    }
  }

  const handleDeleteDailyOrder = async (orderId: string) => {
    try {
        await deleteOrderFromStore(orderId);
        toast({ title: "Success", description: "Daily order deleted."});
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

  const handleCloseAndInvoice = async (invoiceDetails: Partial<FinalInvoiceFormData>) => {
    if (!booking || !client) return;

    const invoiceItems = bookingOrders.flatMap(order => order.clientEvents.map(event => ({
        id: order.id,
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

    const newInvoiceData: FinalInvoiceFormData = {
        ...invoiceDetails,
        id: invoiceDetails.id!,
        clientId: booking.client_id,
        items: invoiceItems,
        startDate: booking.start_date,
        endDate: booking.end_date,
        numberOfDays: bookingOrders.length,
        multiplyByDays: false, // Each order is a line item, so we don't multiply
        status: 'outstanding',
        // Default other fields that are not in the dialog
        proformaId: '',
        selectedEventType: 'Catering services',
        customEventType: '',
        serviceFields: {},
        serviceDesc: invoiceDetails.serviceDesc || `Catering services for ${client.companyName} from ${format(parseISO(booking.start_date), 'PPP')} to ${format(parseISO(booking.end_date), 'PPP')}`,
    };
    
    try {
        const newInvoice = await addInvoice(newInvoiceData);
        if (newInvoice) {
             toast({ title: 'Success', description: `Invoice ${newInvoice.id} created.` });
             router.push(`/invoices/${newInvoice.id}`);
        } else {
            throw new Error("Failed to save invoice to storage.");
        }
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to create invoice.' });
    }
  }

  const isLoading = bookingsLoading || clientsLoading || ordersLoading;
  
  if (isLoading) {
    return <LoadingPage title="Loading Booking Details..." />;
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
            <div className="flex gap-2">
                <Button onClick={() => setIsAddOrderOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Record Daily Order
                </Button>
                 <Button variant="default" onClick={() => setIsCloseBookingOpen(true)} disabled={bookingOrders.length === 0}>
                    <FileCheck className="mr-2 h-4 w-4"/>
                    Close & Generate Invoice
                </Button>
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

        <CloseBookingDialog
            isOpen={isCloseBookingOpen}
            setIsOpen={setIsCloseBookingOpen}
            onSubmit={handleCloseAndInvoice}
        />
    </div>
  );
}
