"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRestrictMarketer } from "../../hooks/useMarketingQuery";

export function RestrictDialog({
  open,
  onOpenChange,
  marketer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string };
}) {
  const { toast } = useToast();
  const restrict = useRestrictMarketer();
  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError("Restriction reason required (min 10 characters)");
      return;
    }
    setError("");
    try {
      await restrict.mutateAsync({ id: marketer.id, reason: reason.trim(), internalNotes: internalNotes.trim() || undefined });
      toast({ title: "Account restricted" });
      setReason("");
      setInternalNotes("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restrict account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restrict Account Access</DialogTitle>
          <DialogDescription>
            {marketer.fullName} will be able to log in and view data but cannot log visits, schedule follow-ups, or update company stages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for restriction *</label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Internal notes (optional)</label>
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={restrict.isPending}>
            {restrict.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Restrict Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
