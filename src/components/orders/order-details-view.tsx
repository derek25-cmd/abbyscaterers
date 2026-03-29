"use client";

import React, { useState } from "react";
import type { Order, ClientEvent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import Link from "next/link";
import { BookOpen, CalendarDays, DollarSign, FileText, Loader2, SquarePen, Users, UtensilsCrossed, Truck, MapPin, User } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { Skeleton } from "../ui/skeleton";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "../ui/badge";
import { CreateDeliveryNoteDialog } from "./create-delivery-note-dialog";
import { getMenusByOrderId } from "@/services/dailyMenuService";
import { DailyMenu } from "@/types";


interface OrderDetailsViewProps {
  order: Order;
}

function ClientEventCard({ event, dailyMenu }: { event: ClientEvent, dailyMenu?: DailyMenu }) {
    const { getRecipeById, isLoading: recipesLoading } = useRecipeStorage();

    const totalPrice = (Number(event.unitPrice) || 0) * (Number(event.numberOfPeople) || 0);

    const formatDateSafe = (dateString?: string, formatString: string = "MMMM d, yyyy") => {
        if (!dateString) return "N/A";
        const parsedDate = parseISO(dateString);
        return isValid(parsedDate) ? format(parsedDate, formatString) : "N/A";
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
    }

    return (
        <Card className="bg-card/50 shadow-sm border-accent/10">
            <CardHeader className="py-3 bg-muted/20 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> {formatDateSafe(event.date)}</span>
                        <Badge variant="outline" className="bg-primary/5">{event.mealType}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {event.region}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4 grid md:grid-cols-2 gap-6">
                 <div>
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2"><UtensilsCrossed className="h-3.5 w-3.5 text-primary"/>Included Recipes</h4>
                    {recipesLoading ? <Skeleton className="h-20 w-full" /> : (
                        <ul className="space-y-1.5 list-disc list-inside text-sm text-foreground">
                            {(() => {
                                // Merge base recipes from order and planner recipes
                                const baseRecipes = event?.recipes || [];
                                const plannerRecipes = dailyMenu?.recipes?.map(r => ({ recipeId: r.recipeId })) || [];
                                
                                // Deduplicate by recipeId
                                const combined = [...baseRecipes];
                                plannerRecipes.forEach(pr => {
                                    if (pr.recipeId && !combined.some(br => br.recipeId === pr.recipeId)) {
                                        combined.push(pr as any);
                                    }
                                });

                                if (combined.length === 0) {
                                    return <li className="text-muted-foreground italic list-none">No recipes assigned.</li>;
                                }

                                return combined.map((r, index) => {
                                    const recipe = getRecipeById(r.recipeId);
                                    return <li key={index} className="pl-1">{recipe?.recipeName || "Unknown Recipe"}</li>;
                                });
                            })()}
                        </ul>
                    )}
                 </div>
                 <div className="md:border-l md:pl-6">
                     <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-primary"/>Pricing & Volume</h4>
                     <div className="text-sm space-y-3">
                        <div className="flex justify-between border-b border-dashed pb-1">
                            <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5"/> Pax:</span> 
                            <span className="font-semibold">{event.numberOfPeople}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed pb-1">
                            <span className="text-muted-foreground">Unit Price:</span> 
                            <span className="font-semibold">{formatCurrency(event.unitPrice)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-accent pt-1">
                            <span>Event Total:</span> 
                            <span>{formatCurrency(totalPrice)}</span>
                        </div>
                        <div className="text-[10px] text-right text-muted-foreground">
                            VAT: <span className="uppercase">{event.vatType}</span>
                        </div>
                     </div>
                 </div>
            </CardContent>
        </Card>
    )
}

export function OrderDetailsView({ order }: OrderDetailsViewProps) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeliveryNoteDialogOpen, setIsDeliveryNoteDialogOpen] = useState(false);
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();
  const client = getClientById(order.clientId);
  const [dailyMenus, setDailyMenus] = useState<DailyMenu[]>([]);
  const [isMenusLoading, setIsMenusLoading] = useState(false);

  React.useEffect(() => {
    const fetchMenus = async () => {
      setIsMenusLoading(true);
      try {
        const menus = await getMenusByOrderId(order.id);
        setDailyMenus(menus);
      } catch (err) {
        console.error("Error fetching daily menus for order:", err);
      } finally {
        setIsMenusLoading(false);
      }
    };
    if (order.id) fetchMenus();
  }, [order.id]);

  const handlePdfExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      pdf.save(`${order.name.replace(/ /g, '_')}_order.pdf`);
      toast({ title: "Export Successful", description: "Order exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
           <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
                <Link href="/orders"><BookOpen className="mr-2 h-4 w-4" /> Back to Orders</Link>
           </Button>
           <h1 className="text-3xl font-bold tracking-tight text-foreground">{order.name}</h1>
           <p className="text-sm font-mono text-muted-foreground">ID: {order.id}</p>
        </div>
        <div className="flex gap-2">
             <Button variant="outline" onClick={() => setIsDeliveryNoteDialogOpen(true)}>
              <Truck className="mr-2 h-4 w-4" /> Create Delivery Note
            </Button>
            <Button variant="outline" onClick={handlePdfExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
               {isExporting ? 'Exporting...' : 'Export PDF'}
            </Button>
            <Link href={`/orders/${order.id}/edit`}>
              <Button>
                <SquarePen className="mr-2 h-4 w-4" /> Edit Order
              </Button>
            </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 border-primary/10">
              <CardHeader>
                  <CardTitle className="text-lg">Customer Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10 text-primary"><User className="h-5 w-5" /></div>
                      <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold">Client Name</p>
                          <p className="font-semibold">{clientsLoading ? <Skeleton className="h-4 w-32" /> : client?.companyName || "N/A"}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-accent/10 text-accent"><CalendarDays className="h-5 w-5" /></div>
                      <div>
                          <p className="text-xs text-muted-foreground uppercase font-bold">Service Period</p>
                          <p className="font-semibold">
                              {order.startDate ? format(parseISO(order.startDate), 'PPP') : 'N/A'} - 
                              <br/>
                              {order.endDate ? format(parseISO(order.endDate), 'PPP') : 'N/A'}
                          </p>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <div ref={printRef} className="md:col-span-2 space-y-4">
            {order.clientEvents && order.clientEvents.length > 0 ? (
                order.clientEvents.map((event, index) => {
                    const eventId = event.id || `EVT-${order.id}-${index}`;
                    const dailyMenu = dailyMenus.find(m => m.event_id === eventId);
                    return <ClientEventCard key={index} event={event} dailyMenu={dailyMenu} />;
                })
            ) : (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>No events have been added to this order yet.</p>
                    </CardContent>
                </Card>
            )}
          </div>
      </div>

      <CreateDeliveryNoteDialog
        isOpen={isDeliveryNoteDialogOpen}
        setIsOpen={setIsDeliveryNoteDialogOpen}
        order={order}
      />
    </div>
  );
}
