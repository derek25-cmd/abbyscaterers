
// @ts-nocheck
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlusCircle, 
  Trash2, 
  CalendarIcon, 
  Check, 
  Loader2, 
  ArrowRight, 
  AlertTriangle 
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useClientStorage } from "@/hooks/use-client-storage";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase-client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NewIssuanceDialog({ isOpen, setIsOpen, assets, employees, orders, onNewIssuance }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [issuedTo, setIssuedTo] = useState('');
    const [items, setItems] = useState([{ assetId: '', quantityIssued: 1 }]);
    const [notes, setNotes] = useState('');
    const [totalValue, setTotalValue] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<'form' | 'review' | 'progress' | 'success'>('form');
    const [currentProgress, setCurrentProgress] = useState(0);
    const [currentItemName, setCurrentItemName] = useState('');
    const { getClientById } = useClientStorage();

    const getFullName = (employee) => {
        if (!employee) return '';
        return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
    }

    const resetForm = () => {
        setSelectedDate(new Date());
        setSelectedOrderIds([]);
        setIssuedTo('');
        setItems([{ assetId: '', quantityIssued: 1 }]);
        setNotes('');
        setTotalValue(0);
        setStep('form');
        setCurrentProgress(0);
        setIsSubmitting(false);
    }
    
    useEffect(() => {
        if (isOpen) {
            resetForm();
        }
    }, [isOpen]);

    useEffect(() => {
        const value = items.reduce((acc, item) => {
            const asset = assets.find(a => a.id === item.assetId);
            return acc + (asset ? asset.unitPrice * item.quantityIssued : 0);
        }, 0);
        setTotalValue(value);
    }, [items, assets]);
    
    const filteredOrders = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return orders.filter(order => 
            order.clientEvents && order.clientEvents.some(event => event.date.startsWith(dateStr))
        );
    }, [orders, selectedDate]);

    const toggleOrderId = (id) => {
        setSelectedOrderIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };


    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const numericValue = parseInt(value, 10);

        if (field === 'quantityIssued' && isNaN(numericValue)) {
            newItems[index][field] = 0;
        } else {
            newItems[index][field] = field === 'quantityIssued' ? numericValue : value;
        }
        
        const asset = assets.find(a => a.id === newItems[index].assetId);
        if (asset && newItems[index].quantityIssued > asset.quantity) {
            newItems[index].quantityIssued = asset.quantity;
        }
        
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { assetId: '', quantityIssued: 1 }]);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleReview = (e) => {
        if (e) e.preventDefault();
        if (selectedOrderIds.length === 0 || !issuedTo || items.length === 0 || items.some(item => !item.assetId || item.quantityIssued <= 0)) {
            alert("Please fill all required fields, including at least one event and one valid item.");
            return;
        }
        setStep('review');
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setStep('progress');
        
        try {
            const employee = employees.find(e => e.id === issuedTo);
            const issuanceRecord = {
                orderId: selectedOrderIds.join(', '),
                issuedTo: getFullName(employee),
                items: items.map(item => {
                    const asset = assets.find(a => a.id === item.assetId);
                    return {
                        assetId: item.assetId,
                        name: asset?.name,
                        type: asset?.type,
                        unitPrice: asset?.unitPrice,
                        quantityIssued: Number(item.quantityIssued),
                    };
                }),
                totalValue,
                notes,
                status: 'Issued',
                date: format(new Date(), 'yyyy-MM-dd'),
            };

            // 1. Create Issuance Record
            setCurrentItemName("Creating issuance record...");
            const { data: newIssuance, error: issueError } = await supabase.from('issuance').insert([issuanceRecord]).select().single();
            if (issueError) throw issueError;
            
            setCurrentProgress(20);
            await new Promise(r => setTimeout(r, 500));

            // 2. Update Asset Quantities one by one for progress feedback
            const totalSteps = items.length;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const asset = assets.find(a => a.id === item.assetId);
                setCurrentItemName(`Updating stock: ${asset?.name || 'Asset'}`);
                
                const { data: currentAsset, error: fetchError } = await supabase.from('assets').select('quantity').eq('id', item.assetId).single();
                if (fetchError) throw fetchError;
                
                const { error: updateError } = await supabase.from('assets').update({ 
                    quantity: (currentAsset?.quantity || 0) - item.quantityIssued 
                }).eq('id', item.assetId);
                
                if (updateError) throw updateError;
                
                const stepProgress = 20 + Math.round(((i + 1) / totalSteps) * 80);
                setCurrentProgress(stepProgress);
                await new Promise(r => setTimeout(r, 300));
            }

            setStep('success');
            if (onNewIssuance) {
                onNewIssuance(issuanceRecord);
            }
        } catch (error) {
            console.error("Issuance Error:", error);
            alert("Failed to issue assets. Part of the process may have failed. Please check the logs.");
            setStep('review');
        } finally {
            setIsSubmitting(false);
        }
    };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
                {step === 'form' && "New Asset Issuance"}
                {step === 'review' && "Review Asset Issuance"}
                {step === 'progress' && "Processing Issuance..."}
                {step === 'success' && "Issuance Successful"}
            </DialogTitle>
            <DialogDescription>
                {step === 'form' && "Select an order, employee, and the assets to be issued."}
                {step === 'review' && "Carefully review the issuance details before confirming."}
                {step === 'progress' && "Please wait while we update records and inventory..."}
                {step === 'success' && "The issuance has been recorded and assets updated."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-1">
          <div className="py-4 space-y-6">
            {step === 'form' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
                    <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Event Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal h-10 border-2",
                                !selectedDate && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
                    <Label htmlFor="employee" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Issued To</Label>
                    <Select onValueChange={setIssuedTo} value={issuedTo}>
                        <SelectTrigger className="h-10 border-2"><SelectValue placeholder="Select an employee" /></SelectTrigger>
                        <SelectContent>
                        {employees.map(employee => (
                            <SelectItem key={employee.id} value={employee.id}>{getFullName(employee)}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-bold flex items-center">
                        Select Events for {format(selectedDate, "MMM dd")}
                        {selectedOrderIds.length > 0 && <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-[10px]">{selectedOrderIds.length}</span>}
                    </Label>
                    <div className="border-2 rounded-lg p-3 space-y-2 min-h-[100px] max-h-[200px] overflow-y-auto bg-muted/5">
                        {filteredOrders.length > 0 ? filteredOrders.map(order => {
                            const client = order.clientEvents && order.clientEvents.length > 0 ? getClientById(order.clientEvents[0].clientId) : null;
                            const isSelected = selectedOrderIds.includes(order.id);
                            return (
                                <div key={order.id} className={cn(
                                    "flex items-center space-x-2 p-2 hover:bg-primary/5 rounded-md transition-all border border-transparent",
                                    isSelected && "bg-primary/5 border-primary/20"
                                )}>
                                    <Checkbox 
                                        id={`order-${order.id}`} 
                                        checked={isSelected}
                                        onCheckedChange={() => toggleOrderId(order.id)}
                                    />
                                    <Label 
                                        htmlFor={`order-${order.id}`}
                                        className="text-xs cursor-pointer flex-1 py-1 flex justify-between items-center"
                                    >
                                        <span className="font-semibold">{client?.companyName || 'Unknown'} - {order.name}</span>
                                        <span className="text-muted-foreground font-mono bg-muted px-1.5 rounded">{order.id}</span>
                                    </Label>
                                </div>
                            )
                        }) : (
                            <div className="text-xs text-muted-foreground italic h-full py-8 flex items-center justify-center">
                                No events found for this date.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center bg-muted/30 p-2 rounded-t-md border-x border-t">
                    <Label className="text-sm font-bold uppercase tracking-tight">Issued Items</Label>
                    <span className="text-[10px] font-mono text-muted-foreground">{items.length} items</span>
                </div>
                <div className="space-y-3">
                {items.map((item, index) => {
                    const asset = assets.find(a => a.id === item.assetId);
                    return (
                        <div key={index} className="flex flex-col md:flex-row items-end gap-3 p-3 border-2 rounded-lg relative hover:border-primary/20 transition-all">
                            <div className="flex-1 w-full">
                                <Label className="text-[10px] font-bold text-muted-foreground mb-1 block">Asset</Label>
                                <Select value={item.assetId} onValueChange={(value) => handleItemChange(index, 'assetId', value)}>
                                    <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select an asset..." /></SelectTrigger>
                                    <SelectContent>
                                        {assets.filter(a => a.quantity > 0 || a.id === item.assetId).map(asset => (
                                            <SelectItem key={asset.id} value={asset.id}>
                                                <div className="flex justify-between w-full gap-2">
                                                    <span>{asset.name}</span>
                                                    <span className="text-muted-foreground text-[10px]">({asset.quantity} left)</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full md:w-32">
                                <Label className="text-[10px] font-bold text-muted-foreground mb-1 block">Quantity</Label>
                                <Input
                                    type="number"
                                    className="h-9 font-bold mt-1"
                                    value={item.quantityIssued}
                                    onChange={(e) => handleItemChange(index, 'quantityIssued', e.target.value)}
                                    min="1"
                                    max={asset?.quantity || 1}
                                />
                                {asset && item.quantityIssued > asset.quantity && <span className="text-[9px] text-destructive font-bold">Max exceeded!</span>}
                            </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    )
                })}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full h-10 border-dashed border-2 hover:bg-primary/5 font-bold" onClick={addItem}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Another Asset
                </Button>
                </div>
                <div className="p-3 border rounded-lg bg-blue-50/50">
                    <Label htmlFor="notes" className="text-[10px] font-bold text-blue-800 uppercase mb-1 block">Special Notes (Optional)</Label>
                    <Textarea id="notes" className="min-h-[80px] bg-white border-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any specific instructions or asset conditions..." />
                </div>
            </div>
            )}

            {step === 'review' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-muted/10 space-y-3">
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Issued To</p>
                                <p className="text-lg font-bold">{getFullName(employees.find(e => e.id === issuedTo))}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Event Date</p>
                                <p className="font-semibold">{format(selectedDate, "PPP")}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Associated Events</p>
                                <p className="text-xs">{selectedOrderIds.length} events selected</p>
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg bg-primary/5 flex flex-col justify-center items-center text-center">
                            <p className="text-[10px] font-bold text-primary uppercase mb-1">Total Valuation</p>
                            <p className="text-3xl font-black text-primary">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(totalValue).replace('TZS', 'TZS ')}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 font-medium">{items.length} unique assets being issued</p>
                        </div>
                    </div>

                    <div className="border-2 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="p-2 text-left">Asset Name</th>
                                    <th className="p-2 text-center">Qty</th>
                                    <th className="p-2 text-right">Unit Value</th>
                                    <th className="p-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map((item, idx) => {
                                    const asset = assets.find(a => a.id === item.assetId);
                                    return (
                                        <tr key={idx} className="hover:bg-muted/30">
                                            <td className="p-2 font-medium">{asset?.name}</td>
                                            <td className="p-2 text-center font-bold px-4 bg-muted/20">{item.quantityIssued}</td>
                                            <td className="p-2 text-right text-muted-foreground">{(asset?.unitPrice || 0).toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold">{(item.quantityIssued * (asset?.unitPrice || 0)).toLocaleString()}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot className="bg-primary/5 font-black border-t-2">
                                <tr>
                                    <td className="p-2 text-primary">TOTAL</td>
                                    <td className="p-2 text-center text-primary">{items.reduce((a,b) => a + b.quantityIssued, 0)}</td>
                                    <td className="p-2"></td>
                                    <td className="p-2 text-right text-primary">{totalValue.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-700 leading-relaxed font-medium">
                            Confirmed items will be deducted from active inventory. Please ensure the physical handoff is completed after clicking confirm.
                        </p>
                    </div>
                </div>
            )}

            {step === 'progress' && (
                <div className="py-16 text-center space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-2xl font-black text-primary animate-in fade-in zoom-in duration-500">{currentProgress}%</h3>
                        <div className="max-w-md mx-auto space-y-2">
                            <p className="font-bold text-lg">{currentItemName}</p>
                            <p className="text-xs text-muted-foreground italic">Updating inventory and issuance logs...</p>
                        </div>
                    </div>
                    <div className="max-w-md mx-auto">
                        <Progress value={currentProgress} className="h-4 border-2 shadow-inner" />
                    </div>
                    <div className="flex justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Secure Transmission</span>
                    </div>
                </div>
            )}

            {step === 'success' && (
                <div className="py-16 text-center space-y-8">
                   <div className="w-24 h-24 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/10 scale-110">
                        <Check className="h-12 w-12 font-black" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-3xl font-black text-green-700">All Set!</h3>
                        <p className="text-muted-foreground font-medium">
                            Issuance for <span className="text-foreground font-bold">{getFullName(employees.find(e => e.id === issuedTo))}</span> has been recorded.
                        </p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg max-w-sm mx-auto border-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-center">
                            <CalendarIcon className="h-3 w-3 mr-1" /> Log Date: {format(new Date(), 'PPP')}
                        </p>
                    </div>
                    <Button className="w-full sm:w-48 h-12 text-lg font-bold" onClick={() => setIsOpen(false)}>
                        Done
                    </Button>
                </div>
            )}
          </div>
          </ScrollArea>

          <DialogFooter className="pt-6 border-t mt-4 gap-2">
            {step === 'form' && (
                <>
                    <Button type="button" variant="outline" className="h-11 px-6 border-2" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button type="button" className="h-11 px-8 font-bold" onClick={handleReview}>
                        Review Issuance <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </>
            )}

            {step === 'review' && (
                <>
                    <Button type="button" variant="outline" className="h-11 px-6 border-2" onClick={() => setStep('form')} disabled={isSubmitting}>Back to Edit</Button>
                    <Button type="button" className="h-11 px-8 font-bold" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Confirm Issuance
                    </Button>
                </>
            )}
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
