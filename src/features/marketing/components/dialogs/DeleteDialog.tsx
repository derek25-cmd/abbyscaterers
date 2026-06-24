"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useDeleteMarketer } from "../../hooks/useMarketingQuery";

export function DeleteDialog({
  open,
  onOpenChange,
  marketer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string };
}) {
  const { toast } = useToast();
  const deleteMarketer = useDeleteMarketer();
  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");

  const canSubmit = reason.trim().length >= 20 && confirmName.trim().toLowerCase() === marketer.fullName.toLowerCase();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError("");
    try {
      const result = await deleteMarketer.mutateAsync({
        id: marketer.id,
        reason: reason.trim(),
        internalNotes: internalNotes.trim() || undefined,
        confirmName: confirmName.trim(),
      });
      if (result.warnings?.length) {
        toast({ variant: "destructive", title: "Account deleted with warnings", description: result.warnings.join(" ") });
      } else {
        toast({ title: "Account deleted" });
      }
      setReason("");
      setInternalNotes("");
      setConfirmName("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-semibold">THIS ACTION CANNOT BE UNDONE</p>
            <p className="mt-2">Deleting this account will:</p>
            <ul className="ml-4 list-disc">
              <li>Revoke their login — they must sign up again from scratch to rejoin</li>
              <li>Anonymise all personal information (name, email, phone, NIDA, TIN)</li>
              <li>Preserve all visit, performance, and commission history for reporting</li>
              <li>Remove this marketer from all active assignments</li>
            </ul>
            <p className="mt-2">Consider Disable if you may need to reinstate this account instead.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for deletion *</label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Internal notes (optional)</label>
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type "{marketer.fullName}" to confirm *</label>
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit || deleteMarketer.isPending}>
            {deleteMarketer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
