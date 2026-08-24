'use client';

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Search, MoreHorizontal, Building2, TrendingDown, Edit2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from "@/services/supplierService";
import { getPurchases } from "@/services/purchaseService";
import { Supplier, Purchase } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { StatsCard } from "@/components/dashboard/stats-card";

const SupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().email("Invalid email").optional().or(z.literal('')).default(''),
  address: z.string().optional().default(''),
  tin: z.string().max(9, "TIN must be 9 digits max").optional().default(''),
  notes: z.string().optional().default(''),
});

type SupplierFormData = z.infer<typeof SupplierSchema>;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(n);

export default function SuppliersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getSuppliers,
    staleTime: 5 * 60 * 1000,
  });

  const { data: purchases = [] } = useQuery<Purchase[]>({
    queryKey: ['purchases'],
    queryFn: getPurchases,
    staleTime: 5 * 60 * 1000,
  });

  // Per-supplier outstanding balance = sum of creditBalance (totalCost - amountPaid) for unpaid/partial
  const supplierBalances = useMemo(() => {
    const map = new Map<string, { outstanding: number; totalSpend: number; invoiceCount: number }>();

    purchases.forEach(p => {
      // Match by supplierId if available, else by supplier name
      const key = p.supplierId || p.supplier.toLowerCase();
      const existing = map.get(key) || { outstanding: 0, totalSpend: 0, invoiceCount: 0 };
      const credit = Math.max(0, p.totalCost - (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0)));
      map.set(key, {
        outstanding: existing.outstanding + credit,
        totalSpend: existing.totalSpend + p.totalCost,
        invoiceCount: existing.invoiceCount + 1,
      });
    });
    return map;
  }, [purchases]);

  const getBalance = (s: Supplier) => {
    return supplierBalances.get(s.id) || supplierBalances.get(s.name.toLowerCase()) || { outstanding: 0, totalSpend: 0, invoiceCount: 0 };
  };

  const filteredSuppliers = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson || '').toLowerCase().includes(q) ||
      (s.tin || '').includes(q)
    );
  }, [suppliers, search]);

  const totals = useMemo(() => ({
    outstanding: suppliers.reduce((sum, s) => sum + getBalance(s).outstanding, 0),
    spend: suppliers.reduce((sum, s) => sum + getBalance(s).totalSpend, 0),
  }), [suppliers, supplierBalances]);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: { name: '', contactPerson: '', phone: '', email: '', address: '', tin: '', notes: '' },
  });

  const openAdd = () => {
    setEditingSupplier(null);
    form.reset({ name: '', contactPerson: '', phone: '', email: '', address: '', tin: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    form.reset({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      tin: s.tin || '',
      notes: s.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteSupplier(id);
    toast({ title: "Deleted", description: "Supplier removed." });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  const handleSubmit = async (values: SupplierFormData) => {
    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, values);
      toast({ title: "Updated", description: `${values.name} updated.` });
    } else {
      await addSupplier(values);
      toast({ title: "Added", description: `${values.name} added to supplier database.` });
    }
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    setDialogOpen(false);
  };

  // Purchases for the detail view
  const detailPurchases = useMemo(() => {
    if (!detailSupplier) return [];
    return purchases.filter(p =>
      p.supplierId === detailSupplier.id || p.supplier.toLowerCase() === detailSupplier.name.toLowerCase()
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [detailSupplier, purchases]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Total Outstanding (AP)"
          value={formatCurrency(totals.outstanding)}
          change={`${suppliers.filter(s => getBalance(s).outstanding > 0).length} suppliers with credit`}
          changeType="negative"
          icon={TrendingDown}
          description="Total credit owed to all suppliers"
        />
        <StatsCard
          title="Total Suppliers"
          value={String(suppliers.length)}
          change={`TZS ${(totals.spend / 1_000_000).toFixed(1)}M total spend`}
          changeType="neutral"
          icon={Building2}
          description="Registered in your supplier database"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Supplier Database</CardTitle>
              <CardDescription>Manage your suppliers and track outstanding credit balances (Accounts Payable).</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 w-[240px]"
                />
              </div>
              <Button onClick={openAdd}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Supplier
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>TIN</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead className="text-right">Outstanding Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliersLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map(s => {
                  const bal = getBalance(s);
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailSupplier(s)}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{s.contactPerson || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="font-mono text-sm">{s.tin || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">{formatCurrency(bal.totalSpend)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={bal.outstanding > 0 ? "text-amber-600" : "text-emerald-600"}>
                          {formatCurrency(bal.outstanding)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {bal.outstanding > 0 ? (
                          <Badge className="bg-amber-500 text-white text-xs">Has Credit</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">Settled</Badge>
                        )}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEdit(s)}><Edit2 className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(s.id)} className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {suppliers.length === 0 ? "No suppliers yet. Add your first supplier." : "No suppliers match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filteredSuppliers.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">Totals</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(filteredSuppliers.reduce((s, sup) => s + getBalance(sup).totalSpend, 0))}</TableCell>
                  <TableCell className="text-right font-bold text-amber-600">
                    {formatCurrency(filteredSuppliers.reduce((s, sup) => s + getBalance(sup).outstanding, 0))}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <DialogHeader>
                <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                <DialogDescription>Supplier details for your database. TIN is used for VAT input tax claims.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Supplier Name</FormLabel><FormControl><Input placeholder="e.g., Mwenge Fresh Foods Ltd" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactPerson" render={({ field }) => (
                    <FormItem><FormLabel>Contact Person <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="Full name" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="+255 XXX XXX XXX" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="supplier@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="tin" render={({ field }) => (
                    <FormItem><FormLabel>TRA TIN <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="9-digit TIN" maxLength={9} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Address <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="Physical address" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="Any additional notes" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingSupplier ? 'Save Changes' : 'Add Supplier'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Supplier Detail / Purchase History Dialog */}
      <Dialog open={!!detailSupplier} onOpenChange={open => !open && setDetailSupplier(null)}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {detailSupplier?.name}
            </DialogTitle>
            <DialogDescription>
              {detailSupplier?.phone && <span className="mr-3">{detailSupplier.phone}</span>}
              {detailSupplier?.tin && <span>TIN: {detailSupplier.tin}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-[55vh] overflow-y-auto">
            {detailSupplier && (() => {
              const bal = getBalance(detailSupplier);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md border p-3 text-center">
                      <div className="text-muted-foreground text-xs">Total Spend</div>
                      <div className="font-bold text-base">{formatCurrency(bal.totalSpend)}</div>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <div className="text-muted-foreground text-xs">Invoices</div>
                      <div className="font-bold text-base">{bal.invoiceCount}</div>
                    </div>
                    <div className={`rounded-md border p-3 text-center ${bal.outstanding > 0 ? 'border-amber-400/50 bg-amber-50/10' : 'border-emerald-400/50 bg-emerald-50/10'}`}>
                      <div className="text-muted-foreground text-xs">Outstanding</div>
                      <div className={`font-bold text-base ${bal.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatCurrency(bal.outstanding)}
                      </div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailPurchases.length > 0 ? detailPurchases.map(p => {
                        const credit = Math.max(0, p.totalCost - (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0)));
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm whitespace-nowrap">{p.date}</TableCell>
                            <TableCell className="font-mono text-sm">{p.invoiceNumber}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(p.totalCost)}</TableCell>
                            <TableCell className="text-right text-sm text-emerald-600">{formatCurrency(p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0))}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{credit > 0 ? <span className="text-amber-600">{formatCurrency(credit)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>
                              <Badge className={`text-white text-xs ${p.paymentStatus === 'paid' ? 'bg-emerald-600' : p.paymentStatus === 'partial' ? 'bg-amber-500' : 'bg-red-500'}`}>
                                {p.paymentStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground text-sm">No purchase records linked to this supplier.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailSupplier(null)}>Close</Button>
            <Button variant="ghost" onClick={() => { setDetailSupplier(null); openEdit(detailSupplier!); }}>
              <Edit2 className="mr-2 h-4 w-4" /> Edit Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
