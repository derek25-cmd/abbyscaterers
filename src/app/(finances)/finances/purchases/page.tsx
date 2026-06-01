
'use client';

import { useState, useMemo } from "react";
import { PlusCircle, Search, FileDown, Package, Wrench, ShoppingBag } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getPurchases, deletePurchase } from "@/services/purchaseService";
import { AddPurchaseDialog } from "@/components/finances/add-purchase-dialog";
import { Purchase } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function PurchasesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: purchases = [], refetch, isLoading } = useQuery<Purchase[]>({
    queryKey: ['purchases'],
    queryFn: getPurchases,
    staleTime: 5 * 60 * 1000,
  });

  const filteredPurchases = useMemo(() => {
    let result = [...purchases];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.supplier.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        (p.event_id || '').toLowerCase().includes(q)
      );
    }
    // Sort newest first
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, searchQuery]);

  // Group by date for display
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Purchase[]>();
    filteredPurchases.forEach(p => {
      const key = p.date.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return [...map.entries()].map(([date, items]) => ({ date, items }));
  }, [filteredPurchases]);

  const totals = useMemo(() => {
    const totalCost = filteredPurchases.reduce((sum, p) => sum + p.totalCost, 0);
    const totalVAT = filteredPurchases.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
    const totalNet = totalCost - totalVAT;
    return { totalCost, totalVAT, totalNet };
  }, [filteredPurchases]);

  const handleAddOrEdit = () => {
    refetch();
    setIsAddDialogOpen(false);
    setEditingPurchase(null);
  };

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deletePurchase(id);
    toast({ title: "Success", description: "Purchase record deleted successfully." });
    refetch();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return isValid(d) ? format(d, 'EEEE, dd MMMM yyyy') : dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("ABBY'S CATERERS — PURCHASES JOURNAL", 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 25);
    doc.text(`Total Records: ${filteredPurchases.length}`, 14, 30);

    (doc as any).autoTable({
      startY: 36,
      theme: 'grid',
      head: [['Date', 'Supplier', 'Description', 'Invoice #', 'Net Cost (TZS)', 'Input VAT (TZS)', 'Total Cost (TZS)', 'Amount Paid (TZS)', 'Credit AP (TZS)', 'Status']],
      body: filteredPurchases.map(p => {
        const netCost = p.totalCost - (p.taxAmount || 0);
        const paid = p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0);
        const credit = Math.max(0, p.totalCost - paid);
        return [
          format(new Date(p.date), "dd/MM/yyyy"),
          p.supplier,
          p.description.slice(0, 30),
          p.invoiceNumber,
          netCost.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          (p.taxAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }),
          p.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          paid.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          credit > 0 ? credit.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—',
          p.paymentStatus,
        ];
      }),
      foot: [['', '', '', 'JOURNAL TOTALS',
        totals.totalNet.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        totals.totalVAT.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        totals.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        filteredPurchases.reduce((s, p) => s + (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0)), 0).toLocaleString('en-US', { maximumFractionDigits: 0 }),
        filteredPurchases.reduce((s, p) => s + Math.max(0, p.totalCost - (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0))), 0).toLocaleString('en-US', { maximumFractionDigits: 0 }),
        '',
      ]],
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30], fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
    });

    doc.save(`purchases-journal-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Purchases Journal</CardTitle>
              <CardDescription>
                Record of all goods and services bought from suppliers. Sorted newest first, grouped by date.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportPDF}>
                <FileDown className="mr-2 h-4 w-4" /> Export PDF
              </Button>
              <Button onClick={() => { setEditingPurchase(null); setIsAddDialogOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Purchase
              </Button>
            </div>
          </div>
          <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by supplier, description, invoice, or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-background pl-8 md:w-[360px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Net Cost</TableHead>
                <TableHead className="text-right">Input VAT</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Credit (AP)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : groupedByDate.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="h-24 text-center">No purchases recorded yet.</TableCell></TableRow>
              ) : (
                groupedByDate.map(({ date, items }) => (
                  <>
                    {/* Date group header */}
                    <TableRow key={`date-${date}`} className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={11} className="py-2 px-4 text-xs font-black uppercase tracking-widest text-muted-foreground border-b">
                        {formatDateLabel(date)}
                        <span className="ml-2 font-normal text-muted-foreground/70">
                          — {items.length} transaction{items.length !== 1 ? 's' : ''}
                          {' · '}
                          {formatCurrency(items.reduce((s, p) => s + p.totalCost, 0))}
                        </span>
                      </TableCell>
                    </TableRow>
                    {/* Purchases for this date */}
                    {items.map((purchase) => {
                      const netCost = purchase.totalCost - (purchase.taxAmount || 0);
                      const paid = purchase.amountPaid ?? (purchase.paymentStatus === 'paid' ? purchase.totalCost : 0);
                      const credit = Math.max(0, purchase.totalCost - paid);
                      const cat = (purchase.expenseCategory || '').toLowerCase();
                      const purchaseType = cat.includes('fixed asset') ? 'fixed_asset' : cat.includes('food') || cat.includes('ingredient') || cat.includes('stock') ? 'stock_in' : 'general';
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">{purchase.supplier}</TableCell>
                          <TableCell className="max-w-[130px] truncate" title={purchase.description}>{purchase.description}</TableCell>
                          <TableCell className="font-mono text-sm">{purchase.invoiceNumber}</TableCell>
                          <TableCell>
                            {purchaseType === 'fixed_asset' ? (
                              <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs gap-1"><Wrench className="h-3 w-3" />Fixed Asset</Badge>
                            ) : purchaseType === 'stock_in' ? (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs gap-1"><Package className="h-3 w-3" />Stock In</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-xs gap-1"><ShoppingBag className="h-3 w-3" />General</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(netCost)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(purchase.taxAmount || 0)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(purchase.totalCost)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatCurrency(paid)}</TableCell>
                          <TableCell className="text-right">
                            {credit > 0
                              ? <span className="font-semibold text-amber-600">{formatCurrency(credit)}</span>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              purchase.paymentStatus === 'paid' ? 'bg-green-600 text-white'
                              : purchase.paymentStatus === 'partial' ? 'bg-amber-500 text-white'
                              : 'bg-red-500 text-white'
                            }>
                              {purchase.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEdit(purchase)}>Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(purchase.id)} className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold text-base">Journal Totals</TableCell>
                <TableCell className="text-right font-bold text-base">{formatCurrency(totals.totalNet)}</TableCell>
                <TableCell className="text-right font-bold text-base text-purple-600">{formatCurrency(totals.totalVAT)}</TableCell>
                <TableCell className="text-right font-bold text-base text-primary">{formatCurrency(totals.totalCost)}</TableCell>
                <TableCell className="text-right font-bold text-base text-emerald-600">
                  {formatCurrency(filteredPurchases.reduce((s, p) => s + (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0)), 0))}
                </TableCell>
                <TableCell className="text-right font-bold text-base text-amber-600">
                  {formatCurrency(filteredPurchases.reduce((s, p) => s + Math.max(0, p.totalCost - (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0))), 0))}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <AddPurchaseDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onSave={handleAddOrEdit}
        purchase={editingPurchase}
      />
    </>
  );
}
