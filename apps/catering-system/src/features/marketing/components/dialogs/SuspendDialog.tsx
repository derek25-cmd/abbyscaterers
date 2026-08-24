"use client";

import { useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSuspendMarketer } from "../../hooks/useMarketingQuery";
import { formatDate } from "../../utils/format";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function SuspendDialog({
  open,
  onOpenChange,
  marketer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string };
}) {
  const { toast } = useToast();
  const suspend = useSuspendMarketer();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const [untilDate, setUntilDate] = useState(toDateInputValue(tomorrow));
  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState("");

  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(untilDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError("Suspension reason required (min 10 characters)");
      return;
    }
    setError("");
    try {
      await suspend.mutateAsync({
        id: marketer.id,
        reason: reason.trim(),
        suspendedUntil: new Date(`${untilDate}T23:59:59`).toISOString(),
        internalNotes: internalNotes.trim() || undefined,
      });
      toast({ title: "Account suspended" });
      setReason("");
      setInternalNotes("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not suspend account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Suspension end date *</label>
            <Input
              type="date"
              value={untilDate}
              min={toDateInputValue(tomorrow)}
              max={toDateInputValue(maxDate)}
              onChange={(e) => setUntilDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Account will automatically reinstate on this date at midnight. Suspension period: {daysRemaining} day{daysRemaining === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for suspension *</label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="This reason will be shown to the marketer." />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Internal notes (optional)</label>
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <Ban className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {marketer.fullName} will be immediately logged out of the mobile app and cannot sign back in until{" "}
              {formatDate(new Date(untilDate).toISOString(), "long")}.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={suspend.isPending}>
            {suspend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Suspend Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
