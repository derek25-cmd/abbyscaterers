'use client';

import { useState, useMemo, useEffect } from "react";
import { PlusCircle, Search, DollarSign, Tag, CalendarIcon, Loader2, ArrowUpRight, Percent, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getExpenses, addExpense, updateExpense, deleteExpense } from "@/services/expenseService";
import { getBookings } from "@/services/bookingService";
import { Expense, Booking } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const ExpenseSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  payee: z.string().min(1, "Payee is required."),
  ref_number: z.string().min(1, "Reference number is required."),
  category: z.enum(['Transport & Fuel', 'Utilities', 'Venue Rent', 'Kitchen Consumables', 'Marketing', 'Office Overhead']),
  description: z.string().min(1, "Description is required."),
  amount: z.number().min(0.01, "Amount must be greater than 0."),
  vat_amount: z.number().min(0, "VAT cannot be negative."),
  payment_md: z.enum(['cash', 'bank', 'mobile_money']),
  event_id: z.string().min(1, "Event ID Linkage is required. Use 'OVERHEAD' for general business expenses."),
});

type ExpenseFormData = z.infer<typeof ExpenseSchema>;

export default function ExpensesPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const { data: expenses = [], refetch, isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: getExpenses,
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: getBookings,
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: {
      payee: "",
      ref_number: "",
      category: "Transport & Fuel",
      description: "",
      amount: 0,
      vat_amount: 0,
      payment_md: "cash",
      event_id: "",
    }
  });

  useEffect(() => {
    if (editingExpense) {
      form.reset({
        ...editingExpense,
        date: new Date(editingExpense.date),
        amount: Number(editingExpense.amount),
        vat_amount: Number(editingExpense.vat_amount),
      });
    } else {
      form.reset({
        date: new Date(),
        payee: "",
        ref_number: "",
        category: "Transport & Fuel",
        description: "",
        amount: 0,
        vat_amount: 0,
        payment_md: "cash",
        event_id: "",
      });
    }
  }, [editingExpense, form, isDialogOpen]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = 
        e.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.event_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.ref_number.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "ALL" || e.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchQuery, categoryFilter]);

  // Aggregate financial metrics
  const metrics = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const eventSpecific = filteredExpenses.filter(e => e.event_id !== "OVERHEAD").reduce((sum, e) => sum + e.amount, 0);
    const generalOverhead = filteredExpenses.filter(e => e.event_id === "OVERHEAD").reduce((sum, e) => sum + e.amount, 0);
    const totalVAT = filteredExpenses.reduce((sum, e) => sum + e.vat_amount, 0);
    return { total, eventSpecific, generalOverhead, totalVAT };
  }, [filteredExpenses]);

  const handleSave = async (values: ExpenseFormData) => {
    const payload = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
    };

    if (editingExpense) {
      await updateExpense(editingExpense.id, payload);
      toast({ title: "Success", description: "Expense updated successfully." });
    } else {
      await addExpense(payload);
      toast({ title: "Success", description: "Expense added successfully." });
    }

    setIsDialogOpen(false);
    setEditingExpense(null);
    refetch();
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsDialogOpen(true);
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
    toast({ title: "Success", description: "Expense record deleted successfully." });
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  };

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operating Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(metrics.total)}</div>
            <p className="text-xs text-muted-foreground">Active filter total expenses</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Direct Event Expenses</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.eventSpecific)}</div>
            <p className="text-xs text-muted-foreground">Directly linked to Event IDs</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">General Business Overheads</CardTitle>
            <Tag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(metrics.generalOverhead)}</div>
            <p className="text-xs text-muted-foreground">Fixed operating and admin costs</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claimable Input VAT Credits</CardTitle>
            <Percent className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(metrics.totalVAT)}</div>
            <p className="text-xs text-muted-foreground">Eligible standard-rated purchases</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Expense Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Expense Book Ledger</CardTitle>
              <CardDescription>
                Record of all operational costs, fuel, rentals, utilities, and casual staff support.
              </CardDescription>
            </div>
            <Button onClick={() => { setEditingExpense(null); setIsDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row items-center gap-4 pt-4">
            <div className="relative w-full md:w-[320px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payee, description, Event ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-background pl-8"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Category:</span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="Transport & Fuel">Transport & Fuel</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Venue Rent">Venue Rent</SelectItem>
                  <SelectItem value="Kitchen Consumables">Kitchen Consumables</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Office Overhead">Office Overhead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Event ID</TableHead>
                <TableHead className="text-right">VAT Amount</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading expenses...</TableCell></TableRow>
              ) : filteredExpenses.length > 0 ? (
                filteredExpenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(exp.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{exp.payee}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-500/5 text-amber-700">
                        {exp.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={exp.description}>{exp.description}</TableCell>
                    <TableCell>
                      <Badge variant={exp.event_id === 'OVERHEAD' ? 'secondary' : 'default'} className={exp.event_id === 'OVERHEAD' ? '' : 'bg-blue-600'}>
                        {exp.event_id}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(exp.vat_amount)}</TableCell>
                    <TableCell className="text-right font-semibold text-foreground">{formatCurrency(exp.amount)}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(exp)}>Edit Record</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteExpense(exp.id)} className="text-destructive">Delete Expense</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No expense records found matching criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right font-bold text-base">Total Expenses</TableCell>
                <TableCell className="text-right font-bold text-base text-primary">{formatCurrency(metrics.total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog for Adding/Editing Expenses */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)}>
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Edit Expense Entry" : "Add New Expense Record"}</DialogTitle>
                <DialogDescription>
                  Capture operational outflows. Tie to an active Event ID or categorize as general OVERHEAD.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Expense</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField control={form.control} name="event_id" render={({ field }) => (
                  <FormItem><FormLabel>Event ID Linkage (Mandatory)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select linked Event or OVERHEAD"/></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="OVERHEAD">OVERHEAD - General Core Business Operations</SelectItem>
                        {bookings.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.id} - {b.name}</SelectItem>
                        ))}
                        <SelectItem value="EVT-2026-0615-C782">EVT-2026-0615-C782 - BoT Gala Dinner (Mock)</SelectItem>
                        <SelectItem value="EVT-2026-0701-W990">EVT-2026-0701-W990 - Private Wedding Reception (Mock)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="payee" render={({ field }) => (
                    <FormItem><FormLabel>Payee / Vendor</FormLabel><FormControl><Input placeholder="e.g. Puma Energy Ltd" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="ref_number" render={({ field }) => (
                    <FormItem><FormLabel>Reference Slip / Receipt #</FormLabel><FormControl><Input placeholder="e.g. REC-99014" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel>Expense Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Transport & Fuel">Transport & Fuel</SelectItem>
                          <SelectItem value="Utilities">Utilities</SelectItem>
                          <SelectItem value="Venue Rent">Venue Rent</SelectItem>
                          <SelectItem value="Kitchen Consumables">Kitchen Consumables</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Office Overhead">Office Overhead</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="payment_md" render={({ field }) => (
                    <FormItem><FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash-in-Hand</SelectItem>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          <SelectItem value="mobile_money">Mobile Money (M-Pesa / TigoPesa)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description of Expenditure</FormLabel><FormControl><Input placeholder="e.g. Fuel for generator and delivery refrigeration units" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Gross Amount Incurred (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="vat_amount" render={({ field }) => (
                    <FormItem><FormLabel>Included VAT Component (if claimable)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={form.formState.isSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingExpense ? 'Save Changes' : 'Record Expense'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
