"use client";

import React, { useEffect, useState } from "react";
import { Order, Issuance, Asset, Employee } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getAssets } from "@/services/assetService";
import { getEmployees } from "@/services/employeeService";
import { getIssuances } from "@/services/issuanceService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackageOpen, Loader2, ArrowRight } from "lucide-react";
import { NewIssuanceDialog } from "@/components/hr/new-issuance-dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

export function OrderIssuanceSection({ targetOrders }: { targetOrders: Order[] }) {
    const { toast } = useToast();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [issuances, setIssuances] = useState<Issuance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isIssuanceDialogOpen, setIsIssuanceDialogOpen] = useState(false);
    
    useEffect(() => {
        if (!targetOrders.length) {
            setIsLoading(false);
            return;
        }
        
        const fetchInitialData = async () => {
             setIsLoading(true);
             try {
                const [assetData, employeeData, allIssuances] = await Promise.all([
                    getAssets(),
                    getEmployees(),
                    getIssuances()
                ]);
                setAssets(assetData);
                setEmployees(employeeData);
                
                // Filter issuances to only this set of orders
                const targetOrderIds = targetOrders.map(o => o.id);
                const relevantIssuances = allIssuances.filter(iss => {
                    if (!iss.orderId) return false;
                    const linkedIds = iss.orderId.split(',').map(s => s.trim()) || [];
                    return linkedIds.some(linkedId => targetOrderIds.includes(linkedId));
                });
                
                setIssuances(relevantIssuances);
             } catch (error) {
                 console.error("Failed to load issuance context", error);
             } finally {
                 setIsLoading(false);
             }
        };
        
        fetchInitialData();
    }, [targetOrders]);

    const handleNewIssuance = (newRecord: any) => {
        setIssuances(prev => [newRecord, ...prev]);
        toast({ title: "Assets Issued", description: "Issuance successfully recorded." });
    };

    if (isLoading) {
        return (
            <Card className="mt-8 opacity-50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                         <Loader2 className="h-5 w-5 animate-spin"/> Loading Assets...
                    </CardTitle>
                </CardHeader>
            </Card>
        );
    }
    
    // We try to default the date of NewIssuanceDialog to the first scheduled event
    const defaultDate = targetOrders[0]?.clientEvents && targetOrders[0].clientEvents.length > 0 
        ? parseISO(targetOrders[0].clientEvents[0].date) 
        : new Date();

    return (
        <Card className="mt-8 border-accent/20 overflow-hidden">
            <CardHeader className="bg-accent/5 pb-4">
                 <div className="flex items-center justify-between">
                     <div>
                         <CardTitle className="flex items-center gap-2">
                             <PackageOpen className="h-5 w-5 text-accent" />
                             Issued Service Assets
                         </CardTitle>
                         <CardDescription>View or allocate assets specifically for this order/booking.</CardDescription>
                     </div>
                     <Button onClick={() => setIsIssuanceDialogOpen(true)} className="gap-2">
                         Issue Assets <ArrowRight className="h-4 w-4"/>
                     </Button>
                 </div>
            </CardHeader>
            <CardContent className="pt-6">
                {issuances.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                         <PackageOpen className="h-10 w-10 mx-auto mb-2 opacity-20" />
                         <p className="text-sm">No assets have been issued for the selected events yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {issuances.map((iss, index) => (
                            <div key={index} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-lg bg-background hover:bg-muted/10 transition-colors">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold">Allocated to {iss.issuedTo}</p>
                                    <div className="flex gap-2 text-xs text-muted-foreground">
                                         <span>{iss.date && !isNaN(Date.parse(iss.date)) ? format(parseISO(iss.date), 'PPP') : iss.date}</span>
                                         <span>&bull;</span>
                                         <span className="font-mono bg-muted/50 px-1 rounded">{iss.items.length} unique items</span>
                                    </div>
                                    <div className="flex flex-col gap-1 mt-2">
                                        {iss.items.map((it, i) => (
                                            <Badge key={i} variant="outline" className="bg-primary/5 text-xs font-medium border-primary/20 w-fit">
                                                {it.quantityIssued}x {it.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-4 md:mt-0 flex flex-col items-end gap-2">
                                    <Badge variant={iss.status === 'Returned' ? 'outline' : 'default'} className={
                                        iss.status === 'Issued' ? "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" :
                                        iss.status === 'Returned' ? "text-green-600 border-green-500/30" : ""
                                    }>
                                        {iss.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* @ts-ignore - untyped component */}
            <NewIssuanceDialog
               isOpen={isIssuanceDialogOpen}
               setIsOpen={setIsIssuanceDialogOpen}
               assets={assets}
               employees={employees.filter(e => e.status === 'Active')}
               orders={targetOrders}
               onNewIssuance={handleNewIssuance}
               defaultOrderIds={targetOrders.map(o => o.id)}
               defaultDate={defaultDate}
            />
        </Card>
    );
}
