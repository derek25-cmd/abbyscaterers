
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
import { getSales, deleteSale } from "@/services/saleService";
import { AddSaleDialog } from "@/components/finances/add-sale-dialog";
import { Sale } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useClientStorage } from "@/hooks/use-client-storage";

export default function SalesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { clients } = useClientStorage();

  const { data: sales = [], refetch, isLoading } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: getSales,
  });

  const getClientName = (customerId: string) => {
    const client = clients.find(c => c.id === customerId);
    return client?.companyName || 'Unknown';
  };

  const filteredSales = useMemo(() => {
    if (!searchQuery) return sales;
    return sales.filter(s => 
      getClientName(s.customerId).toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sales, searchQuery, clients]);

  const handleAddOrEdit = () => {
    refetch();
    setIsAddDialogOpen(false);
    setEditingSale(null);
  };
  
  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setIsAddDialogOpen(true);
  }

  const handleDelete = async (id: string) => {
    await deleteSale(id);
    toast({
      title: "Success",
      description: "Sale record deleted successfully.",
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
              <CardTitle>Sales Book</CardTitle>
              <CardDescription>
                Record of all revenue-generating activities like catering orders and event sales.
              </CardDescription>
            </div>
            <Button onClick={() => { setEditingSale(null); setIsAddDialogOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Sale
            </Button>
          </div>
           <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, description, or invoice..."
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
                <TableHead>Customer</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : filteredSales.length > 0 ? (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{format(new Date(sale.date), "PPP")}</TableCell>
                    <TableCell>{getClientName(sale.customerId)}</TableCell>
                    <TableCell>{sale.description}</TableCell>
                    <TableCell>{sale.invoiceNumber}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sale.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={sale.paymentStatus === 'paid' ? 'default' : 'outline'} className={sale.paymentStatus === 'paid' ? 'bg-green-600' : ''}>
                        {sale.paymentStatus}
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
                                <DropdownMenuItem onClick={() => handleEdit(sale)}>Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(sale.id)} className="text-destructive">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No sales recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddSaleDialog 
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onSave={handleAddOrEdit}
        sale={editingSale}
        clients={clients}
      />
    </>
  );
}
