'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProformaPreview {
  id: string;
  clientId: string | null;
  invoiceDate: string;
  itemsSubtotal: number;
}

export function LinkProformaForm({ rfqId }: { rfqId: string }) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [proformaId, setProformaId] = useState('');
  const [preview, setPreview] = useState<ProformaPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    setError(null);
    setPreview(null);
    if (!proformaId.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('id, "clientId", "invoiceDate", items')
        .eq('id', proformaId.trim())
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError(`No proforma with ID "${proformaId.trim()}" found.`);
        return;
      }
      setPreview({
        id: data.id,
        clientId: data.clientId,
        invoiceDate: data.invoiceDate,
        itemsSubtotal: (data.items ?? []).reduce(
          (sum: number, item: { total?: number }) => sum + (item.total ?? 0),
          0
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmLink = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('link_rfq_to_proforma', {
        p_rfq_id: rfqId,
        p_proforma_id: preview.id,
      });
      if (error) throw error;
      setPreview(null);
      setProformaId('');
      queryClient.invalidateQueries({ queryKey: ['rfq-links', rfqId] });
      queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] });
      queryClient.invalidateQueries({ queryKey: ['rfq-history', rfqId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link proforma');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <h3 className="text-sm font-medium">Link a proforma</h3>
      <div className="flex gap-2">
        <Input
          value={proformaId}
          onChange={(e) => {
            setProformaId(e.target.value);
            setPreview(null);
            setError(null);
          }}
          placeholder="Proforma ID (e.g. 0015123)"
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={lookup} disabled={busy || !proformaId.trim()}>
          Look up
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {preview && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Proforma</span>{' '}
            <span className="font-mono">{preview.id}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Client</span> {preview.clientId ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Date</span> {preview.invoiceDate}
          </p>
          <p>
            <span className="text-muted-foreground">Items subtotal</span> TZS{' '}
            {preview.itemsSubtotal.toLocaleString()}
          </p>
          <Button type="button" size="sm" className="mt-2" onClick={confirmLink} disabled={busy}>
            {busy ? 'Linking…' : 'Confirm link'}
          </Button>
        </div>
      )}
    </div>
  );
}
