'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { RequestInvoiceButton, type InvoiceRequestSummary } from '@/components/rfq/request-invoice-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

interface ProformaRow {
  id: string;
  invoiceDate: string;
  items: { total?: number }[] | null;
  isInvoiced: boolean | null;
  isVoided: boolean | null;
}

export function RequestInvoiceByClient() {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients-for-invoice-request'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, companyName')
        .order('companyName', { ascending: true });
      if (error) throw error;
      return data as { id: string; companyName: string }[];
    },
  });

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients ?? [];
    const q = clientSearch.trim().toLowerCase();
    return (clients ?? []).filter((c) => c.companyName.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const proformasQuery = useQuery({
    queryKey: ['client-proformas', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('id, "invoiceDate", items, "isInvoiced", "isVoided"')
        .eq('clientId', clientId)
        .order('invoiceDate', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as ProformaRow[];
    },
  });

  const requestsQuery = useQuery({
    queryKey: ['client-invoice-requests', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const proformaIds = (proformasQuery.data ?? []).map((p) => p.id);
      if (proformaIds.length === 0) return new Map<string, InvoiceRequestSummary>();
      const { data, error } = await supabase
        .from('portal_invoice_requests')
        .select('proforma_id, status, invoice_id, rejection_reason, requested_at')
        .in('proforma_id', proformaIds)
        .order('requested_at', { ascending: false });
      if (error) throw error;
      const latestByProforma = new Map<string, InvoiceRequestSummary>();
      for (const row of data ?? []) {
        if (!latestByProforma.has(row.proforma_id)) {
          latestByProforma.set(row.proforma_id, {
            status: row.status,
            invoiceId: row.invoice_id,
            rejectionReason: row.rejection_reason,
          });
        }
      }
      return latestByProforma;
    },
  });

  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-2">
        <Label>Client</Label>
        <Input
          type="text"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          placeholder="Search clients…"
        />
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          size={clientSearch.trim() ? Math.min(6, Math.max(2, filteredClients.length + 1)) : undefined}
          className={selectClass}
        >
          <option value="">Select a client…</option>
          {filteredClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>

      {clientId && (
        <Card className="overflow-x-auto">
          {proformasQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading proformas…</p>
          ) : proformasQuery.error ? (
            <p className="p-4 text-sm text-destructive">
              Failed to load proformas: {(proformasQuery.error as Error).message}
            </p>
          ) : !proformasQuery.data || proformasQuery.data.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No proformas found for this client.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proforma ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items subtotal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proformasQuery.data.map((p) => {
                  const subtotal = (p.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell>{p.invoiceDate}</TableCell>
                      <TableCell>TZS {subtotal.toLocaleString()}</TableCell>
                      <TableCell>
                        {p.isVoided ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">
                            Uninvoiced
                          </Badge>
                        ) : p.isInvoiced ? (
                          <Badge variant="secondary">Already invoiced</Badge>
                        ) : (
                          <Badge variant="outline">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.isInvoiced || p.isVoided ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <RequestInvoiceButton
                            proformaId={p.id}
                            latestRequest={requestsQuery.data?.get(p.id) ?? null}
                            onRequested={() =>
                              queryClient.invalidateQueries({ queryKey: ['client-invoice-requests', clientId] })
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
