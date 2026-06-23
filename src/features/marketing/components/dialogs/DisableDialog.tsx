"use client";

import { useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useDisableMarketer } from "../../hooks/useMarketingQuery";

export function DisableDialog({
  open,
  onOpenChange,
  marketer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string };
}) {
  const { toast } = useToast();
  const disable = useDisableMarketer();
  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError("Reason required (min 10 characters)");
      return;
    }
    setError("");
    try {
      await disable.mutateAsync({ id: marketer.id, reason: reason.trim(), internalNotes: internalNotes.trim() || undefined });
      toast({ title: "Account disabled" });
      setReason("");
      setInternalNotes("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for disabling *</label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="This reason will be shown to the marketer." />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Internal notes (optional)</label>
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <Ban className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              IMMEDIATE EFFECT: {marketer.fullName} will be logged out of the mobile app right now and cannot sign back in until you reinstate them.
              This has no automatic end date.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={disable.isPending}>
            {disable.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Disable Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
