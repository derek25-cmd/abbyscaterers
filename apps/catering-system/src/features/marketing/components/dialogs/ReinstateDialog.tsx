"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useReinstateMarketer } from "../../hooks/useMarketingQuery";
import { formatDate } from "../../utils/format";

export function ReinstateDialog({
  open,
  onOpenChange,
  marketer,
  disabledReason,
  disabledAt,
  suspensionReason,
  suspendedUntil,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string };
  disabledReason?: string | null;
  disabledAt?: string | null;
  suspensionReason?: string | null;
  suspendedUntil?: string | null;
}) {
  const { toast } = useToast();
  const reinstate = useReinstateMarketer();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const reason = disabledReason ?? suspensionReason;
  const since = disabledAt;

  const handleSubmit = async () => {
    setError("");
    try {
      await reinstate.mutateAsync({ id: marketer.id, notes: notes.trim() || undefined });
      toast({ title: "Account reinstated" });
      setNotes("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reinstate account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reinstate Account</DialogTitle>
          <DialogDescription>Restore full access for {marketer.fullName}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {reason && (
            <div className="rounded-md border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Why they were blocked</p>
              <p>{reason}</p>
              {since && <p className="mt-1 text-xs text-muted-foreground">Since {formatDate(since, "long")}</p>}
              {suspendedUntil && <p className="text-xs text-muted-foreground">Was scheduled until {formatDate(suspendedUntil, "long")}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={reinstate.isPending}>
            {reinstate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Reinstate Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
