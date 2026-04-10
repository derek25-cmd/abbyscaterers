// @ts-nocheck
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { PlusCircle, Trash2, Check, ChevronsUpDown, ArrowRight, CalendarIcon, AlertTriangle, Download, FileWarning, CheckCircle2, XCircle } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { BRANCHES, BRANCH_KEYS } from "@/types";
import { Badge } from "../ui/badge";
import jsPDF from "jspdf";

// --- Draft Types ---
export interface StockOutDraftItem {
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  orderId: string;
  actual_unit_price: number;
  unit: string;
  availableAtDraft: number;
  shortfall: number;
}

export interface StockOutDraft {
  id: string;
  branch: string;
  date: string;
  items: StockOutDraftItem[];
  createdAt: string;
  status: 'pending' | 'ready';
}

const DRAFTS_STORAGE_KEY = 'stock_out_drafts';

export function getDraftsFromStorage(): StockOutDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraftsToStorage(drafts: StockOutDraft[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
}

export function removeDraftFromStorage(draftId: string) {
  const drafts = getDraftsFromStorage().filter(d => d.id !== draftId);
  saveDraftsToStorage(drafts);
}

// --- Component ---
interface LogStockMovementDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  logType: 'Stock In' | 'Stock Out';
  onLogMovement: (movement: any) => Promise<any>;
  products: any[];
  draftToResume?: StockOutDraft | null;
  onDraftSaved?: ((draft?: StockOutDraft) => void) | null;
  onDraftCompleted?: ((draftId: string) => void) | null;
}

export function LogStockMovementDialog({ isOpen, setIsOpen, logType, onLogMovement, products, draftToResume = null, onDraftSaved = null, onDraftCompleted = null }: LogStockMovementDialogProps) {
  const [items, setItems] = useState([{ productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
  const [date, setDate] = useState(new Date());
  const [branch, setBranch] = useState('Dar es Salaam');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('form');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentItemName, setCurrentItemName] = useState('');
  const [results, setResults] = useState({ success: 0, failed: 0, errors: [] });
  const [resumingDraftId, setResumingDraftId] = useState(null);
  const { orders } = useOrderStorage();
  
  const stockInReasons = ["Vendor Delivery", "Internal Production", "Stock Transfer"];
  const stockOutReasons = ["Customer Order", "Internal Use", "Spoilage", "Breakage", "Stock Transfer", "Training costs"];
  const reasonOptions = logType === 'Stock In' ? stockInReasons : stockOutReasons;

  const getProduct = (productId) => products.find(p => p.id === productId);

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return 'TZS 0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const getBranchQty = (product) => {
    if (!product || !branch) return product?.quantity || 0;
    const branchKey = BRANCH_KEYS[branch];
    return Number(product[branchKey?.qty]) || 0;
  };

  const getBranchPrice = (product) => {
    if (!product || !branch) return product?.unitPrice || 0;
    const branchKey = BRANCH_KEYS[branch];
    return Number(product[branchKey?.price]) || 0;
  };

  const summary = useMemo(() => {
    const validItems = items.filter(item => item.productId && item.quantity > 0);
    const totalValue = validItems.reduce((acc, item) => acc + (Number(item.actual_unit_price) * Number(item.quantity)), 0);
    const totalQuantity = validItems.reduce((acc, item) => acc + Number(item.quantity), 0);
    return { totalValue, totalQuantity, itemCount: validItems.length };
  }, [items]);

  // Compute shortages for Stock Out review
  const reviewData = useMemo(() => {
    if (logType !== 'Stock Out') return { items: [], hasShortages: false, shortageCount: 0 };
    
    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.reason && item.actual_unit_price >= 0);
    const reviewItems = validItems.map(item => {
      const product = getProduct(item.productId);
      const available = getBranchQty(product);
      const shortfall = Math.max(0, item.quantity - available);
      return {
        ...item,
        productName: product?.name || 'Unknown',
        unit: product?.unit || '',
        available,
        shortfall,
        isAdequate: shortfall === 0,
      };
    });
    
    const shortageCount = reviewItems.filter(i => !i.isAdequate).length;
    return { items: reviewItems, hasShortages: shortageCount > 0, shortageCount };
  }, [items, products, branch, logType]);

  useEffect(() => {
    if (isOpen) {
      if (draftToResume) {
        // Resume from draft
        setResumingDraftId(draftToResume.id);
        setBranch(draftToResume.branch);
        setDate(new Date(draftToResume.date));
        setItems(draftToResume.items.map(di => ({
          productId: di.productId,
          quantity: di.quantity,
          reason: di.reason,
          orderId: di.orderId || '',
          actual_unit_price: di.actual_unit_price,
        })));
        // Go straight to review for draft resume
        setTimeout(() => setStep('review'), 100);
      } else {
        setItems([{ productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
        setDate(new Date());
        setStep('form');
        setResumingDraftId(null);
      }
      setCurrentProgress(0);
      setCurrentItemName('');
      setResults({ success: 0, failed: 0, errors: [] });
    }
  }, [isOpen, draftToResume]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const numericValue = parseFloat(value);

    if (field === 'quantity' || field === 'actual_unit_price') {
      newItems[index][field] = isNaN(numericValue) ? 0 : numericValue;
    } else {
      newItems[index][field] = value;
    }
    
    if (field === 'productId') {
        const product = getProduct(value);
        if (product && branch) {
            const branchKey = BRANCH_KEYS[branch];
            newItems[index]['actual_unit_price'] = Number(product[branchKey?.price]) || product.unitPrice || 0;
        }
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const handleReview = (e) => {
    if (e) e.preventDefault();
    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.reason && item.actual_unit_price >= 0);
    
    if (validItems.length < items.length) {
        if (!confirm("Some items are incomplete or invalid and will be skipped. Continue to review?")) {
            return;
        }
    }

    if (validItems.length === 0) {
        alert("Please add at least one valid item to log.");
        return;
    }
    setStep('review');
  };

  const handleSubmit = async () => {
    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.reason && item.actual_unit_price >= 0);
    setStep('progress');
    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const product = getProduct(item.productId);
        setCurrentItemName(product?.name || 'Unknown Item');
        
        try {
            let finalReason = item.reason;
            if (item.reason === 'Customer Order' && item.orderId) {
                finalReason = `Customer Order: ${item.orderId}`;
            }
            
            const result = await onLogMovement({
                productId: item.productId,
                productName: product?.name || 'Unknown',
                type: logType,
                reason: finalReason,
                quantity: Number(item.quantity),
                price: Number(item.actual_unit_price) * Number(item.quantity),
                actual_unit_price: Number(item.actual_unit_price),
                date: format(date, 'yyyy-MM-dd'),
                branch: branch,
            });

            if (result === null) throw new Error("Service returned failure");
            
            successCount++;
        } catch (error) {
            console.error(`Failed to log ${product?.name}:`, error);
            failCount++;
            errors.push(`${product?.name || 'Unknown'}: ${error.message || 'Unknown error'}`);
        }
        
        setCurrentProgress(Math.round(((i + 1) / validItems.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 200)); 
    }
    
    // If we were resuming a draft and it succeeded, remove it
    if (resumingDraftId && successCount > 0) {
      removeDraftFromStorage(resumingDraftId);
      onDraftCompleted?.(resumingDraftId);
    }

    setResults({ success: successCount, failed: failCount, errors });
    setStep('success');
    setIsSubmitting(false);
  };

  // --- Save as Draft ---
  const handleSaveAsDraft = () => {
    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.reason && item.actual_unit_price >= 0);
    
    const draftItems: StockOutDraftItem[] = validItems.map(item => {
      const product = getProduct(item.productId);
      const available = getBranchQty(product);
      return {
        productId: item.productId,
        productName: product?.name || 'Unknown',
        quantity: item.quantity,
        reason: item.reason,
        orderId: item.orderId || '',
        actual_unit_price: item.actual_unit_price,
        unit: product?.unit || '',
        availableAtDraft: available,
        shortfall: Math.max(0, item.quantity - available),
      };
    });

    const draft: StockOutDraft = {
      id: resumingDraftId || `DRAFT-${Date.now()}`,
      branch,
      date: format(date, 'yyyy-MM-dd'),
      items: draftItems,
      createdAt: resumingDraftId 
        ? getDraftsFromStorage().find(d => d.id === resumingDraftId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      status: 'pending',
    };

    // Replace or add draft
    const existing = getDraftsFromStorage().filter(d => d.id !== draft.id);
    saveDraftsToStorage([...existing, draft]);
    onDraftSaved?.(draft);
    setStep('draft_saved');
  };

  // --- Export Shortage PDF ---
  const handleExportShortagePDF = () => {
    const shortItems = reviewData.items.filter(i => !i.isAdequate);
    if (shortItems.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = pageWidth - 28;
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("STOCK SHORTAGE REPORT", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Branch: ${branch}`, 14, 32);
    doc.text(`Date: ${format(date, "dd/MM/yyyy")}`, 14, 38);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 44);
    doc.text(`Total Shortage Items: ${shortItems.length}`, 14, 50);
    
    // Table config — colWidths must sum to tableWidth (182)
    const startY = 60;
    const colWidths = [8, 40, 18, 20, 20, 12, 28, 36]; // #, Product, Available, Requested, Required, Unit, Unit Price, Cost
    const headers = ["#", "Product", "Available", "Requested", "Required", "Unit", "Unit Price", "Cost (TZS)"];
    const rightAlignCols = [2, 3, 4, 6, 7]; // indices of right-aligned columns
    
    // Table header row
    doc.setFillColor(41, 37, 36);
    doc.rect(14, startY - 6, tableWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.1);
    
    let xPos = 14;
    headers.forEach((header, idx) => {
      // Draw header column dividers
      if (idx > 0) doc.line(xPos, startY - 6, xPos, startY + 2);
      
      if (rightAlignCols.includes(idx)) {
        doc.text(header, xPos + colWidths[idx] - 2, startY, { align: 'right' });
      } else {
        doc.text(header, xPos + 2, startY);
      }
      xPos += colWidths[idx];
    });
    
    // Draw black border around the header
    doc.setDrawColor(0, 0, 0);
    doc.rect(14, startY - 6, tableWidth, 8, 'D');
    
    // Table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    
    let yPos = startY + 2; // Right below header
    let grandTotal = 0;

    shortItems.forEach((item, idx) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
        
        // Redraw header on new page
        doc.setFillColor(41, 37, 36);
        doc.rect(14, yPos - 8, tableWidth, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setDrawColor(255, 255, 255);
        
        let tx = 14;
        headers.forEach((h, i) => {
          if (i > 0) doc.line(tx, yPos - 8, tx, yPos);
          if (rightAlignCols.includes(i)) {
            doc.text(h, tx + colWidths[i] - 2, yPos - 2.5, { align: 'right' });
          } else {
            doc.text(h, tx + 2, yPos - 2.5);
          }
          tx += colWidths[i];
        });
        doc.setDrawColor(0, 0, 0);
        doc.rect(14, yPos - 8, tableWidth, 8, 'D');
        
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
      }
      
      // Alternating row bg
      if (idx % 2 === 0) {
        doc.setFillColor(254, 243, 199);
        doc.rect(14, yPos, tableWidth, 8, 'F');
      }
      
      const lineCost = item.actual_unit_price * item.shortfall;
      grandTotal += lineCost;

      const rowData = [
        `${idx + 1}`,
        item.productName.length > 24 ? item.productName.substring(0, 22) + '...' : item.productName,
        `${item.available}`,
        `${item.quantity}`,
        `${item.shortfall}`,
        item.unit,
        item.actual_unit_price.toLocaleString(),
        lineCost.toLocaleString(),
      ];
      
      // Draw grid lines
      doc.setDrawColor(0, 0, 0);
      doc.rect(14, yPos, tableWidth, 8, 'D'); // Row outline
      
      let currentXPos = 14;
      rowData.forEach((text, colIdx) => {
        // Vertical divider for each column
        if (colIdx > 0) doc.line(currentXPos, yPos, currentXPos, yPos + 8);
        
        if (rightAlignCols.includes(colIdx)) {
          doc.text(text, currentXPos + colWidths[colIdx] - 2, yPos + 5.5, { align: 'right' });
        } else {
          doc.text(text, currentXPos + 2, yPos + 5.5);
        }
        currentXPos += colWidths[colIdx];
      });
      
      yPos += 8;
    });
    
    // Grand total row (flush with the last table row)
    doc.setFillColor(41, 37, 36);
    doc.rect(14, yPos, tableWidth, 10, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.rect(14, yPos, tableWidth, 10, 'D'); // Outer border for total row
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("TOTAL PURCHASE REQUIRED:", 16, yPos + 6.5);
    doc.text(`TZS ${grandTotal.toLocaleString()}`, 14 + tableWidth - 2, yPos + 6.5, { align: 'right' });
    
    // Footer note
    doc.setTextColor(0, 0, 0);
    yPos += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text("Please procure the above items before the stock-out batch can be processed.", 14, yPos);

    doc.save(`Shortage_Report_${branch.replace(/\s/g,'_')}_${format(date, "yyyy-MM-dd")}.pdf`);
  };



  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-3xl"
        onInteractOutside={(e) => {
            e.preventDefault();
        }}
        >
        <form onSubmit={handleReview}>
          <DialogHeader>
            <DialogTitle>{logType}{resumingDraftId ? ' (Resuming Draft)' : ''}</DialogTitle>
            <DialogDescription>
              {step === 'form' && "Log one or more stock movements into the inventory."}
              {step === 'review' && (logType === 'Stock Out' && reviewData.hasShortages 
                ? `⚠️ ${reviewData.shortageCount} item(s) have insufficient stock. Review shortages below.`
                : "Carefully review the movements before confirming."
              )}
              {step === 'progress' && `Processing item ${Math.ceil((currentProgress / 100) * summary.itemCount)} of ${summary.itemCount}...`}
              {step === 'success' && "Batch processing complete."}
              {step === 'draft_saved' && "Draft has been saved successfully."}
            </DialogDescription>
          </DialogHeader>

          {step === 'form' && (
          <>
          <ScrollArea className="h-[60vh] p-1">
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2 border rounded-md bg-muted/30">
                <div>
                  <Label className="block mb-2 font-semibold">Branch <span className="text-destructive">*</span></Label>
                  <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block mb-2 font-semibold">Date of Movement</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                    />
                    </PopoverContent>
                  </Popover>
                </div>
             </div>
            {items.map((item, index) => {
                const product = getProduct(item.productId);
                const catalogPrice = getBranchPrice(product);
                const priceVariation = item.actual_unit_price - catalogPrice;
                const currentStock = getBranchQty(product);
                const hasShortage = logType === 'Stock Out' && product && item.quantity > currentStock;

               return (
               <Card key={index} className={cn(
                 "relative p-4 border-2 transition-colors",
                 hasShortage ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60" : "border-muted hover:border-primary/20"
               )}>
                {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <Label>Product <span className="text-destructive">*</span></Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                    "w-full justify-between mt-1",
                                    !item.productId && "text-muted-foreground"
                                )}
                                >
                                {item.productId
                                    ? products.find(
                                        (p) => p.id === item.productId
                                    )?.name
                                    : "Select product..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                <CommandInput placeholder="Search product..." />
                                <CommandList>
                                    <CommandEmpty>No product found.</CommandEmpty>
                                    <CommandGroup>
                                    {(products || []).map((p) => (
                                        <CommandItem
                                        value={`${p.name} (${p.id})`}
                                        key={p.id}
                                        onSelect={() => handleItemChange(index, 'productId', p.id)}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            p.id === item.productId ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="flex-1">{p.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">Qty: {getBranchQty(p)}</span>
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                     </div>
                     <div>
                        <Label>Quantity <span className="text-destructive">*</span></Label>
                        <Input type="number" step="any" className="mt-1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="0.01" />
                        {hasShortage && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                <p className="text-[10px] text-destructive font-bold">
                                    Short by {(item.quantity - currentStock).toFixed(2)} {product?.unit} in {branch}
                                </p>
                            </div>
                        )}
                     </div>
                 </div>
                 
                {product && (
                    <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                         <div className="p-2 bg-muted/50 rounded-md border">
                            <p className="text-muted-foreground">In Stock ({branch})</p>
                            <p className={cn("font-bold", hasShortage && "text-destructive")}>{currentStock} {product.unit}</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-md border">
                            <p className="text-muted-foreground">Branch Price</p>
                            <p className="font-bold">{formatCurrency(catalogPrice)}</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-md border">
                            <p className="text-muted-foreground">Actual Unit Price</p>
                            <p className="font-bold">{formatCurrency(item.actual_unit_price)}</p>
                        </div>
                         <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
                            <p className="text-primary font-semibold">Line Total</p>
                            <p className="font-bold">{formatCurrency(item.actual_unit_price * item.quantity)}</p>
                        </div>
                    </div>
                )}


                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <Label>Reason <span className="text-destructive">*</span></Label>
                        <Select onValueChange={(value) => handleItemChange(index, 'reason', value)} value={item.reason}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                          <SelectContent>
                            {reasonOptions.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                          </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Actual Price (per unit)</Label>
                        <Input type="number" className="mt-1" value={item.actual_unit_price} onChange={(e) => handleItemChange(index, 'actual_unit_price', e.target.value)} min="0" step="any" />
                    </div>
                 </div>

                 {item.reason === 'Customer Order' && (
                     <div className="mt-4">
                        <Label>Customer Order <span className="text-destructive">*</span></Label>
                        <Select onValueChange={(value) => handleItemChange(index, 'orderId', value)} value={item.orderId}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select an order" /></SelectTrigger>
                            <SelectContent>
                                {orders.map(o => (<SelectItem key={o.id} value={o.id}>{o.name} ({o.id})</SelectItem>))}
                            </SelectContent>
                        </Select>
                     </div>
                 )}

                 {product && (
                    <div className="mt-3 p-2 bg-blue-500/5 border border-blue-500/20 rounded-md">
                        <p className="text-[10px] md:text-xs font-semibold text-blue-800 flex justify-between">
                            <span>Price Variation (vs Branch Price):</span>
                            <span className={cn("font-bold", priceVariation > 0 ? "text-destructive" : priceVariation < 0 ? "text-green-600" : "text-muted-foreground")}>
                                {priceVariation !== 0 && (priceVariation > 0 ? '+' : '')}{formatCurrency(priceVariation)}
                            </span>
                        </p>
                    </div>
                 )}
               </Card>
               )
            })}
             <Button type="button" variant="outline" size="sm" className="w-full h-12 border-dashed border-2 hover:bg-primary/5" onClick={addItem}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Product
              </Button>
          </div>
          </ScrollArea>
          <div className="mt-4 p-4 border rounded-lg bg-primary/5 grid grid-cols-4 gap-4">
              <div className="text-center border-r">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Branch</p>
                <p className="text-sm font-bold">{branch}</p>
              </div>
              <div className="text-center border-r">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Items</p>
                <p className="text-xl font-bold">{summary.itemCount}</p>
              </div>
              <div className="text-center border-r">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Quantity</p>
                <p className="text-xl font-bold">{summary.totalQuantity.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Value</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(summary.totalValue)}</p>
              </div>
          </div>
          </>
          )}

          {step === 'review' && (
              <div className="space-y-6 py-4">
                  <div className="p-3 bg-muted/30 rounded-md border text-sm">
                    <span className="font-semibold">Branch:</span> {branch} &nbsp;|&nbsp; <span className="font-semibold">Date:</span> {format(date, "PPP")}
                    {resumingDraftId && (
                      <Badge variant="outline" className="ml-3 text-[9px] font-bold bg-amber-100 text-amber-800 border-amber-300">DRAFT RESUME</Badge>
                    )}
                  </div>

                  {/* Shortage Alert Banner */}
                  {logType === 'Stock Out' && reviewData.hasShortages && (
                    <div className="p-4 bg-destructive/5 border-2 border-destructive/30 rounded-lg flex items-start gap-3">
                      <FileWarning className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
                          Insufficient Stock Detected
                        </h4>
                        <p className="text-xs text-destructive/80 mt-1">
                          {reviewData.shortageCount} product(s) require additional stock before this batch can be processed. 
                          You can export the shortage list as a PDF and save this batch as a draft.
                        </p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="mt-3 text-xs font-bold bg-background border-destructive/30 text-destructive hover:bg-destructive/5"
                          onClick={handleExportShortagePDF}
                        >
                          <Download className="h-3.5 w-3.5 mr-2" />
                          Export Shortage List (PDF)
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="border rounded-md overflow-hidden max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                              <tr>
                                  <th className="p-2 text-left">Product</th>
                                  <th className="p-2 text-right">Qty</th>
                                  {logType === 'Stock Out' && (
                                    <>
                                      <th className="p-2 text-right">Available</th>
                                      <th className="p-2 text-center">Status</th>
                                    </>
                                  )}
                                  <th className="p-2 text-right">Unit Price</th>
                                  <th className="p-2 text-right">Total</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {(logType === 'Stock Out' ? reviewData.items : items.filter(i => i.productId && i.quantity > 0)).map((item, idx) => {
                                  const p = logType === 'Stock Out' ? item : (() => { const pr = getProduct(item.productId); return { ...item, productName: pr?.name, unit: pr?.unit, available: getBranchQty(pr), isAdequate: true, shortfall: 0 }; })();
                                  const isShort = logType === 'Stock Out' && !p.isAdequate;
                                  return (
                                      <tr key={idx} className={cn(
                                        "hover:bg-muted/30",
                                        isShort && "bg-destructive/5"
                                      )}>
                                          <td className="p-2 font-medium">
                                            {p.productName}
                                            {isShort && <span className="text-[9px] text-destructive font-bold ml-2">SHORTAGE</span>}
                                          </td>
                                          <td className="p-2 text-right">{item.quantity} {p.unit}</td>
                                          {logType === 'Stock Out' && (
                                            <>
                                              <td className="p-2 text-right">{p.available} {p.unit}</td>
                                              <td className="p-2 text-center">
                                                {p.isAdequate ? (
                                                  <Badge className="bg-green-100 text-green-700 border-green-300 text-[9px] font-bold gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> OK
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="destructive" className="text-[9px] font-bold gap-1">
                                                    <XCircle className="h-3 w-3" /> -{p.shortfall}
                                                  </Badge>
                                                )}
                                              </td>
                                            </>
                                          )}
                                          <td className="p-2 text-right">{formatCurrency(item.actual_unit_price)}</td>
                                          <td className="p-2 text-right font-bold">{formatCurrency(item.actual_unit_price * item.quantity)}</td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                          <tfoot className="bg-muted/50 font-bold sticky bottom-0 z-10 shadow-sm border-t">
                              <tr>
                                  <td className="p-2 bg-muted/50">TOTAL</td>
                                  <td className="p-2 text-right bg-muted/50">{summary.totalQuantity.toFixed(2)}</td>
                                  {logType === 'Stock Out' && (
                                    <>
                                      <td className="p-2 bg-muted/50"></td>
                                      <td className="p-2 bg-muted/50"></td>
                                    </>
                                  )}
                                  <td className="p-2 bg-muted/50"></td>
                                  <td className="p-2 text-right text-primary bg-muted/50">{formatCurrency(summary.totalValue)}</td>
                              </tr>
                          </tfoot>
                      </table>
                  </div>

                  {/* Accuracy check or shortage notice */}
                  {logType === 'Stock Out' && reviewData.hasShortages ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <h4 className="text-sm font-bold text-amber-800 flex items-center mb-1">
                        <AlertTriangle className="h-4 w-4 mr-2" /> Save as Draft
                      </h4>
                      <p className="text-xs text-amber-700">
                        This batch cannot be processed until all items have adequate stock in <strong>{branch}</strong>. 
                        Save it as a draft and come back after restocking the short items.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <h4 className="text-sm font-bold text-yellow-800 flex items-center mb-1">
                        <Check className="h-4 w-4 mr-2" /> Accuracy Check
                      </h4>
                      <p className="text-xs text-yellow-700">
                        Please verify all quantities and prices above. Once confirmed, these stock movements will be irreversibly logged for <strong>{branch}</strong> on {format(date, "PPP")}.
                      </p>
                    </div>
                  )}
              </div>
          )}

          {step === 'progress' && (
              <div className="py-12 space-y-6 text-center">
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                        {currentProgress}%
                    </div>
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted" />
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * currentProgress) / 100} className="text-primary transition-all duration-300" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{currentItemName}</h3>
                    <p className="text-muted-foreground animate-pulse">Processing movement...</p>
                  </div>
                  <Progress value={currentProgress} className="w-full h-2" />
              </div>
          )}

          {step === 'success' && (
              <div className="py-8 space-y-6">
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center">
                          <Check className="h-10 w-10" />
                      </div>
                      <div>
                          <h3 className="text-2xl font-bold text-green-700">Successfully Processed!</h3>
                          <p className="text-muted-foreground">
                              {results.success} items logged successfully to <strong>{branch}</strong>.
                              {results.failed > 0 && <span className="text-destructive font-bold ml-1"> {results.failed} failed.</span>}
                          </p>
                      </div>
                  </div>

                  {results.errors.length > 0 && (
                      <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-md">
                          <p className="text-xs font-bold text-destructive mb-2 uppercase">Error Report:</p>
                          <ScrollArea className="h-24">
                              <ul className="text-xs space-y-1">
                                  {results.errors.map((err, i) => (
                                      <li key={i} className="flex items-start">
                                          <span className="text-destructive mr-2">•</span>
                                          {err}
                                      </li>
                                  ))}
                              </ul>
                          </ScrollArea>
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="p-3 border rounded-md text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Success</p>
                          <p className="text-xl font-bold text-green-600">{results.success}</p>
                      </div>
                      <div className="p-3 border rounded-md text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Failed</p>
                          <p className="text-xl font-bold text-destructive">{results.failed}</p>
                      </div>
                  </div>
              </div>
          )}

          {step === 'draft_saved' && (
              <div className="py-8 space-y-6">
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 bg-amber-500/20 text-amber-600 rounded-full flex items-center justify-center">
                          <FileWarning className="h-10 w-10" />
                      </div>
                      <div>
                          <h3 className="text-2xl font-bold text-amber-700">Draft Saved</h3>
                          <p className="text-muted-foreground">
                              This batch has been saved as a draft for <strong>{branch}</strong>. 
                              You can resume it from the Stock Logs page after restocking the short items.
                          </p>
                      </div>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 font-semibold">
                      💡 Tip: Stock in the missing quantities, then click "Resume" on the draft card to complete this batch.
                    </p>
                  </div>
              </div>
          )}

          <DialogFooter className="pt-4 gap-2">
            {step === 'form' && (
                <>
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting || summary.itemCount === 0}>
                    Review Movements
                </Button>
                </>
            )}

            {step === 'review' && (
                <>
                <Button type="button" variant="outline" onClick={() => setStep('form')} disabled={isSubmitting}>
                    Back to Edit
                </Button>
                {logType === 'Stock Out' && reviewData.hasShortages ? (
                  <Button type="button" onClick={handleSaveAsDraft} className="bg-amber-600 hover:bg-amber-700 text-white">
                    <FileWarning className="h-4 w-4 mr-2" />
                    Save as Draft
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Processing..." : "Confirm & Log All"}
                  </Button>
                )}
                </>
            )}

            {step === 'progress' && (
                <div className="text-xs text-muted-foreground italic w-full text-center">
                    Processing batch... please do not close this window.
                </div>
            )}

            {(step === 'success' || step === 'draft_saved') && (
                <Button type="button" className="w-full" onClick={() => setIsOpen(false)}>
                    Close
                </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
