"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Ports apps/admin-portal/src/components/rfq/link-proforma-form.tsx's
// exact-ID lookup → preview → confirm flow into a Dialog, rather than
// building a new search UI — same proven pattern on both sides of the
// RFQ↔proforma link, calling the same link_rfq_to_proforma() RPC (already
// SECURITY DEFINER and already staff-callable, see
// supabase/migrations/20260901080000_rfq_answer_and_notifications.sql).
interface ProformaPreview {
  id: string;
  clientId: string | null;
  invoiceDate: string;
  itemsSubtotal: number;
}

export function LinkExistingProformaDialog({
  rfqId,
  isOpen,
  setIsOpen,
}: {
  rfqId: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [proformaId, setProformaId] = useState("");
  const [preview, setPreview] = useState<ProformaPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setProformaId("");
    setPreview(null);
    setError(null);
  };

  const lookup = async () => {
    setError(null);
    setPreview(null);
    if (!proformaId.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("proforma_invoices")
        .select('id, "clientId", "invoiceDate", items')
        .eq("id", proformaId.trim())
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
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmLink = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("link_rfq_to_proforma", {
        p_rfq_id: rfqId,
        p_proforma_id: preview.id,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["rfq-requests"] });
      reset();
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link proforma");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Existing Proforma</DialogTitle>
          <DialogDescription>Link RFQ {rfqId} to a proforma that already exists.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={proformaId}
            onChange={(e) => {
              setProformaId(e.target.value);
              setPreview(null);
              setError(null);
            }}
            placeholder="Proforma ID (e.g. 0015123)"
          />
          <Button type="button" variant="outline" onClick={lookup} disabled={busy || !proformaId.trim()}>
            Look up
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {preview && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Proforma</span>{" "}
              <span className="font-mono">{preview.id}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Client</span> {preview.clientId ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Date</span> {preview.invoiceDate}
            </p>
            <p>
              <span className="text-muted-foreground">Items subtotal</span> TZS{" "}
              {preview.itemsSubtotal.toLocaleString()}
            </p>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={confirmLink} disabled={busy || !preview}>
            {busy ? "Linking…" : "Confirm link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
