
'use client';

import { useState, useMemo } from "react";
import { PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    return purchases.filter(p => 
      p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [purchases, searchQuery]);

  const handleAddOrEdit = () => {
    refetch();
    setIsAddDialogOpen(false);
    setEditingPurchase(null);
  };
  
  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setIsAddDialogOpen(true);
  }

  const handleDelete = async (id: string) => {
    await deletePurchase(id);
    toast({
      title: "Success",
      description: "Purchase record deleted successfully.",
    });
    refetch();
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Purchases Book</CardTitle>
              <CardDescription>
                Record of all goods and services bought (ingredients, consumables, etc.).
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
                placeholder="Search by supplier, description, or invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-background pl-8 md:w-[320px]"
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
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : filteredPurchases.length > 0 ? (
                filteredPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{format(new Date(purchase.date), "PPP")}</TableCell>
                    <TableCell>{purchase.supplier}</TableCell>
                    <TableCell>{purchase.description}</TableCell>
                    <TableCell>{purchase.invoiceNumber}</TableCell>
                    <TableCell className="text-right">{formatCurrency(purchase.totalCost)}</TableCell>
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No purchases recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
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
