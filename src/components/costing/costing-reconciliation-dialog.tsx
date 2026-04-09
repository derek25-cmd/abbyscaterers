import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import { useProductStorage } from "@/hooks/use-product-storage";
import { Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Branch, BRANCHES } from "@/types";

export function CostingReconciliationDialog({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedBranch, setSelectedBranch] = useState<Branch>('Dar es Salaam');
    const [isSaving, setIsSaving] = useState(false);
    const [step, setStep] = useState<'form' | 'review' | 'progress' | 'success'>('form');
    const [currentProgress, setCurrentProgress] = useState(0);
    const [currentItemName, setCurrentItemName] = useState('');
    const { toast } = useToast();

    const { logs, isLoading: logsLoading, updateStockLog, refreshLogs } = useStockLogStorage();
    const { products, isLoading: productsLoading } = useProductStorage();

    const dailyLogs = useMemo(() => {
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        return logs.filter(log => {
            const logDateStr = log.date ? log.date.substring(0, 10) : '';
            return logDateStr === selectedDateStr && log.type === 'Stock Out' && !log.reason?.includes('Branch Transfer') && (log.branch || 'Dar es Salaam') === selectedBranch;
        });
    }, [selectedDate, selectedBranch, logs]);

    const [actuals, setActuals] = useState<Record<string, number>>({});

    useEffect(() => {
        if (isOpen) {
            setStep('form');
            setCurrentProgress(0);
        }
    }, [isOpen]);

    useEffect(() => {
        if (dailyLogs.length > 0) {
            const initialActuals: Record<string, number> = {};
            dailyLogs.forEach(log => {
                initialActuals[log.id] = log.actual_quantity ?? log.quantity;
            });
            setActuals(initialActuals);
        } else {
            setActuals({});
        }
    }, [dailyLogs]);

    const summaryImpact = useMemo(() => {
        let totalForecastCost = 0;
        let totalActualCost = 0;
        let modifiedCount = 0;

        dailyLogs.forEach(log => {
            const unitPrice = log.actual_unit_price || 0;
            const actualQ = actuals[log.id] ?? log.quantity;
            totalForecastCost += log.quantity * unitPrice;
            totalActualCost += actualQ * unitPrice;
            if (actualQ !== log.quantity) modifiedCount++;
        });

        return {
            totalForecastCost,
            totalActualCost,
            variance: totalActualCost - totalForecastCost,
            modifiedCount
        };
    }, [dailyLogs, actuals]);

    const handleSaveReconciliation = async () => {
        setStep('progress');
        setIsSaving(true);
        const updates = Object.entries(actuals).map(([logId, actualQty]) => ({
            id: logId,
            data: { actual_quantity: Number(actualQty) }
        }));
        
        let successCount = 0;
        try {
            for (let i = 0; i < updates.length; i++) {
                const update = updates[i];
                const log = dailyLogs.find(l => l.id === update.id);
                setCurrentItemName(log?.productName || 'Unknown');
                
                await updateStockLog(update.id, update.data);
                
                successCount++;
                setCurrentProgress(Math.round(((i + 1) / updates.length) * 100));
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            setStep('success');
            toast({ title: "Reconciliation Saved", description: `${successCount} items updated successfully for ${selectedBranch}.` });
        } catch (e) {
            console.error("Save Error:", e);
            toast({ variant: "destructive", title: "Save Failed", description: "An error occurred during reconciliation." });
            setStep('review');
        } finally {
            setIsSaving(false);
            refreshLogs();
        }
    };


    const isLoading = logsLoading || productsLoading;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'form' && "Reconcile Daily Stock Logs"}
                        {step === 'review' && "Review Reconciliation Impact"}
                        {step === 'progress' && "Processing Updates..."}
                        {step === 'success' && "Reconciliation Complete"}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 pt-4">
                    {step === 'form' && (
                    <>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-lg bg-muted/20">
                        <Label className="whitespace-nowrap font-semibold">Select Date:</Label>
                        <div className="w-full sm:w-48">
                            <DatePicker 
                                selectedDate={selectedDate} 
                                onDateChange={setSelectedDate}
                            />
                        </div>
                        <Label className="whitespace-nowrap font-semibold ml-auto">Branch:</Label>
                        <Select value={selectedBranch} onValueChange={(v) => setSelectedBranch(v as Branch)}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                    ) : dailyLogs.length === 0 ? (
                        <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            No Stock Out logs found for {selectedBranch} on {format(selectedDate, 'PPP')}
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto shadow-sm">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="p-3 font-semibold">Product</th>
                                        <th className="p-3 font-semibold text-center">Forecast Qty</th>
                                        <th className="p-3 font-semibold text-center">Actual Qty</th>
                                        <th className="p-3 font-semibold text-right">Actual Cost</th>
                                        <th className="p-3 font-semibold text-right">Variance (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyLogs.map((log) => {
                                        const product = products.find(p => p.id === log.productId);
                                        const unitPrice = log.actual_unit_price || 0;
                                        const actualQ = actuals[log.id] ?? log.quantity;
                                        const actualCost = actualQ * unitPrice;
                                        const forecastCost = log.quantity * unitPrice;
                                        const variancePercentage = forecastCost > 0 ? ((actualCost - forecastCost) / forecastCost) * 100 : 0;
                                        
                                        return (
                                            <tr key={log.id} className="hover:bg-primary/5 transition-colors border-b last:border-0">
                                                <td className="p-3">
                                                    <div className="font-bold">{log.productName}</div>
                                                    <div className="text-[10px] text-muted-foreground">{product?.category} • {product?.unit}</div>
                                                </td>
                                                <td className="p-3 text-center font-medium bg-muted/10">{log.quantity.toFixed(2)}</td>
                                                <td className="p-2 text-center min-w-[120px]">
                                                    <Input 
                                                        type="number" 
                                                        step="any" 
                                                        className="h-9 w-24 mx-auto text-center font-bold border-2 focus:ring-primary/20" 
                                                        value={actuals[log.id] ?? ''} 
                                                        onChange={e => setActuals({...actuals, [log.id]: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                                                    />
                                                </td>
                                                <td className="p-3 text-right font-bold">{actualCost.toLocaleString()}</td>
                                                <td className={`p-3 text-right font-black ${actualQ > log.quantity ? 'text-destructive' : actualQ < log.quantity ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                    {actualQ > log.quantity ? '+' : ''}{variancePercentage.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    </>
                    )}

                    {step === 'review' && (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg bg-muted/10 space-y-2">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Total Impact Summary</p>
                                    <div className="flex justify-between items-center text-sm">
                                        <span>Total Forecast Value:</span>
                                        <span className="font-mono">{summaryImpact.totalForecastCost.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span>Total Actual Value:</span>
                                        <span className="font-bold font-mono">{summaryImpact.totalActualCost.toLocaleString()}</span>
                                    </div>
                                    <div className="border-t pt-2 flex justify-between items-center font-bold text-lg">
                                        <span>Net Variance:</span>
                                        <span className={cn(summaryImpact.variance > 0 ? "text-destructive" : summaryImpact.variance < 0 ? "text-green-600" : "")}>
                                            {summaryImpact.variance > 0 ? '+' : ''}{summaryImpact.variance.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg bg-primary/5 flex flex-col justify-center items-center">
                                    <p className="text-3xl font-black text-primary">{summaryImpact.modifiedCount}</p>
                                    <p className="text-sm font-bold text-muted-foreground">Items with Variations</p>
                                    <p className="text-xs text-center mt-2 text-muted-foreground">
                                        Comparing {dailyLogs.length} logged stock movements for {format(selectedDate, 'PPP')} ({selectedBranch}).
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg flex items-start gap-4">
                                <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-bold text-yellow-800">Careful Review Required</h4>
                                    <p className="text-xs text-yellow-700 leading-relaxed">
                                        Saving these actual quantities will update the stock logs and directly impact the costing reports for {selectedBranch}.
                                        Ensure all manual entries are verified against physical production sheets.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'progress' && (
                        <div className="py-12 space-y-6 text-center">
                            <div className="max-w-md mx-auto space-y-2">
                                <h3 className="font-bold text-xl">{currentItemName}</h3>
                                <p className="text-sm text-muted-foreground">Updating stock log actuals...</p>
                            </div>
                            <div className="relative pt-1 font-bold">
                                <div className="flex mb-2 items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">
                                            Overall Progress
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-semibold inline-block text-primary">
                                            {currentProgress}%
                                        </span>
                                    </div>
                                </div>
                                <Progress value={currentProgress} className="h-3" />
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-12 text-center space-y-6">
                            <div className="w-20 h-20 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mx-auto scale-110">
                                <Check className="h-10 w-10 font-black" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-green-700">Reconciliation Saved!</h3>
                                <p className="text-muted-foreground mt-2">
                                    Physical actuals for {selectedBranch} on {format(selectedDate, 'PPP')} have been successfully recorded.
                                </p>
                            </div>
                            <Button className="w-full sm:w-48 mx-auto" onClick={() => setIsOpen(false)}>
                                Close Window
                            </Button>
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        {step === 'form' && (
                            <>
                                <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancel</Button>
                                <Button onClick={() => setStep('review')} disabled={isSaving || dailyLogs.length === 0}>
                                    Review Impact
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </>
                        )}

                        {step === 'review' && (
                            <>
                                <Button variant="outline" onClick={() => setStep('form')} disabled={isSaving}>Back to Edit</Button>
                                <Button onClick={handleSaveReconciliation} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Confirm and Save All
                                </Button>
                            </>
                        )}
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}
