'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { RequestInvoiceButton, type InvoiceRequestSummary } from '@/components/rfq/request-invoice-button';

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
      <div className="max-w-md">
        <label className="text-sm font-medium">Client</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Search by selecting a client…</option>
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>

      {clientId && (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          {proformasQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading proformas…</p>
          ) : proformasQuery.error ? (
            <p className="p-4 text-sm text-destructive">
              Failed to load proformas: {(proformasQuery.error as Error).message}
            </p>
          ) : !proformasQuery.data || proformasQuery.data.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No proformas found for this client.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Proforma ID</th>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Items subtotal</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {proformasQuery.data.map((p) => {
                  const subtotal = (p.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-mono text-xs">{p.id}</td>
                      <td className="p-3">{p.invoiceDate}</td>
                      <td className="p-3">TZS {subtotal.toLocaleString()}</td>
                      <td className="p-3">
                        {p.isVoided ? (
                          <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs">
                            Uninvoiced
                          </span>
                        ) : p.isInvoiced ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Already invoiced</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Open</span>
                        )}
                      </td>
                      <td className="p-3">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
