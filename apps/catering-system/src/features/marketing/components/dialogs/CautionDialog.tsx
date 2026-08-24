"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCautionMarketer } from "../../hooks/useMarketingQuery";

export function CautionDialog({
  open,
  onOpenChange,
  marketer,
  cautionCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string };
  cautionCount: number;
}) {
  const { toast } = useToast();
  const caution = useCautionMarketer();
  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (reason.trim().length < 20) {
      setError("Caution reason must be at least 20 characters");
      return;
    }
    setError("");
    try {
      await caution.mutateAsync({ id: marketer.id, reason: reason.trim(), internalNotes: internalNotes.trim() || undefined });
      toast({ title: "Caution issued" });
      setReason("");
      setInternalNotes("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not issue caution");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Formal Caution</DialogTitle>
          <DialogDescription>This will be recorded in {marketer.fullName}&apos;s account history.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for caution *</label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the behaviour or issue that warrants this caution. Be specific — the marketer will see this message."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Internal notes (not shown to marketer)</label>
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              The marketer will see a warning banner in their app until they acknowledge it. This is their formal caution #{cautionCount + 1}.
              {cautionCount >= 2 && (
                <span className="mt-1 block font-medium text-destructive">
                  This marketer has already received {cautionCount} cautions. Consider whether a stronger action is more appropriate.
                </span>
              )}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={caution.isPending}>
            {caution.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Issue Caution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
