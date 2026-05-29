
'use client';

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getPurchases } from "@/services/purchaseService";
import { getSuppliers } from "@/services/supplierService";
import { Purchase, Supplier } from "@/types";
import { format } from "date-fns";
import { Search, BookUp, TrendingDown, ChevronDown, ChevronRight } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { cn } from "@/lib/utils";
import Link from "next/link";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(n);

const creditOf = (p: Purchase) =>
  Math.max(0, p.totalCost - (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0)));

export default function PayablesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const { data: purchases = [], isLoading } = useQuery<Purchase[]>({
    queryKey: ['purchases'],
    queryFn: getPurchases,
    staleTime: 5 * 60 * 1000,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getSuppliers,
    staleTime: 5 * 60 * 1000,
  });

  // All purchases with outstanding credit (unpaid or partial)
  const outstandingPurchases = useMemo(() =>
    purchases.filter(p => p.paymentStatus !== 'paid' || creditOf(p) > 0),
    [purchases]
  );

  // Group by supplier name (or supplierId if linked)
  const supplierGroups = useMemo(() => {
    const map = new Map<string, { label: string; supplierId?: string; purchases: Purchase[]; total: number }>();

    outstandingPurchases.forEach(p => {
      const key = p.supplierId || p.supplier.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.purchases.push(p);
        existing.total += creditOf(p);
      } else {
        map.set(key, {
          label: p.supplier,
          supplierId: p.supplierId,
          purchases: [p],
          total: creditOf(p),
        });
      }
    });

    // Use canonical name from supplier DB if linked
    suppliers.forEach(s => {
      const g = map.get(s.id);
      if (g) g.label = s.name;
    });

    return [...map.entries()]
      .map(([key, val]) => ({ key, ...val }))
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [outstandingPurchases, suppliers]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return supplierGroups;
    const q = searchQuery.toLowerCase();
    return supplierGroups
      .map(g => ({
        ...g,
        purchases: g.purchases.filter(p =>
          p.supplier.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.label.toLowerCase().includes(q) || g.purchases.length > 0);
  }, [supplierGroups, searchQuery]);

  const totalPayables = useMemo(() =>
    filteredGroups.reduce((sum, g) => sum + g.total, 0),
    [filteredGroups]
  );

  const partialCount = outstandingPurchases.filter(p => p.paymentStatus === 'partial').length;
  const unpaidCount = outstandingPurchases.filter(p => p.paymentStatus === 'unpaid').length;

  const toggleExpand = (key: string) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Accounts Payable"
          value={formatCurrency(totalPayables)}
          change={`${filteredGroups.length} suppliers with outstanding credit`}
          changeType="negative"
          icon={TrendingDown}
          description="Total credit owed to suppliers"
        />
        <div className="rounded-lg border bg-card p-4 flex flex-col justify-between">
          <div className="text-sm text-muted-foreground">Partial Payments</div>
          <div className="text-2xl font-bold text-amber-600">{partialCount}</div>
          <div className="text-xs text-muted-foreground">invoices partially paid</div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex flex-col justify-between">
          <div className="text-sm text-muted-foreground">Fully Unpaid</div>
          <div className="text-2xl font-bold text-red-600">{unpaidCount}</div>
          <div className="text-xs text-muted-foreground">invoices with no payment</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><BookUp /> Accounts Payable Ledger</CardTitle>
              <CardDescription>
                Outstanding supplier credit grouped by supplier. Click a row to see individual invoices.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by supplier or invoice..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 w-[280px]"
                />
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/finances/suppliers">Manage Suppliers</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">Loading payables...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">No outstanding supplier balances.</div>
          ) : (
            <div className="space-y-1">
              {filteredGroups.map(group => {
                const isExpanded = expandedSuppliers.has(group.key);
                return (
                  <div key={group.key} className="rounded-md border overflow-hidden">
                    {/* Supplier header row */}
                    <button
                      onClick={() => toggleExpand(group.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <span className="font-semibold">{group.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{group.purchases.length} invoice{group.purchases.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="font-bold text-amber-600 text-base">{formatCurrency(group.total)}</div>
                    </button>

                    {/* Expanded invoice rows */}
                    {isExpanded && (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="pl-10">Date</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                            <TableHead className="text-right">Amount Paid</TableHead>
                            <TableHead className="text-right">Credit Balance</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.purchases.map(p => {
                            const paid = p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0);
                            const credit = creditOf(p);
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="pl-10 text-sm whitespace-nowrap">{format(new Date(p.date), "dd/MM/yyyy")}</TableCell>
                                <TableCell className="font-mono text-sm">{p.invoiceNumber}</TableCell>
                                <TableCell className="text-sm max-w-[160px] truncate" title={p.description}>{p.description}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(p.totalCost)}</TableCell>
                                <TableCell className="text-right text-sm text-emerald-600">{formatCurrency(paid)}</TableCell>
                                <TableCell className="text-right font-semibold text-amber-600">{formatCurrency(credit)}</TableCell>
                                <TableCell>
                                  <Badge className={cn("text-white text-xs capitalize",
                                    p.paymentStatus === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                                  )}>
                                    {p.paymentStatus}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={3} className="pl-10 text-right font-semibold text-sm">Subtotal</TableCell>
                            <TableCell className="text-right font-semibold text-sm">
                              {formatCurrency(group.purchases.reduce((s, p) => s + p.totalCost, 0))}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm text-emerald-600">
                              {formatCurrency(group.purchases.reduce((s, p) => s + (p.amountPaid ?? (p.paymentStatus === 'paid' ? p.totalCost : 0)), 0))}
                            </TableCell>
                            <TableCell className="text-right font-bold text-amber-600">{formatCurrency(group.total)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableFooter>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {filteredGroups.length > 0 && (
            <div className="mt-4 flex justify-end border-t pt-3">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Outstanding</div>
                <div className="text-xl font-bold text-amber-600">{formatCurrency(totalPayables)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
