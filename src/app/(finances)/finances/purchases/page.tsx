
'use client';

import { useState, useMemo } from "react";
import { PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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
  });

  const filteredPurchases = useMemo(() => {
    if (!searchQuery) return purchases;
    const q = searchQuery.toLowerCase();
    return purchases.filter(p =>
      p.supplier.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.invoiceNumber.toLowerCase().includes(q) ||
      (p.event_id || '').toLowerCase().includes(q)
    );
  }, [purchases, searchQuery]);

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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Purchases Journal</CardTitle>
              <CardDescription>
                Record of all goods and services bought from suppliers (ingredients, consumables, equipment, services). Each entry is sourced from a supplier invoice.
              </CardDescription>
            </div>
            <Button onClick={() => { setEditingPurchase(null); setIsAddDialogOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Purchase
            </Button>
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
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Event ID</TableHead>
                <TableHead className="text-right">Net Cost</TableHead>
                <TableHead className="text-right">Input VAT</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : filteredPurchases.length > 0 ? (
                filteredPurchases.map((purchase) => {
                  const netCost = purchase.totalCost - (purchase.taxAmount || 0);
                  return (
                    <TableRow key={purchase.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(purchase.date), "PPP")}</TableCell>
                      <TableCell className="font-medium">{purchase.supplier}</TableCell>
                      <TableCell className="max-w-[160px] truncate" title={purchase.description}>{purchase.description}</TableCell>
                      <TableCell className="font-mono text-sm">{purchase.invoiceNumber}</TableCell>
                      <TableCell>
                        {purchase.event_id ? (
                          <Badge variant="default" className="bg-blue-600 text-xs">{purchase.event_id}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(netCost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(purchase.taxAmount || 0)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(purchase.totalCost)}</TableCell>
                      <TableCell>
                        <Badge variant={purchase.paymentStatus === 'paid' ? 'default' : 'outline'} className={purchase.paymentStatus === 'paid' ? 'bg-green-600' : ''}>
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
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    No purchases recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="text-right font-bold text-base">Journal Totals</TableCell>
                <TableCell className="text-right font-bold text-base">{formatCurrency(totals.totalNet)}</TableCell>
                <TableCell className="text-right font-bold text-base text-purple-600">{formatCurrency(totals.totalVAT)}</TableCell>
                <TableCell className="text-right font-bold text-base text-primary">{formatCurrency(totals.totalCost)}</TableCell>
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
