"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePurgeMarketer } from "../../hooks/useMarketingQuery";

const CONFIRM_PHRASE = "PERMANENTLY DELETE";

export function PurgeDialog({
  open,
  onOpenChange,
  marketer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketer: { id: string; fullName: string };
}) {
  const { toast } = useToast();
  const purgeMarketer = usePurgeMarketer();
  const [reason, setReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [error, setError] = useState("");

  const canSubmit = reason.trim().length >= 20 && confirmPhrase.trim() === CONFIRM_PHRASE;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError("");
    try {
      const result = await purgeMarketer.mutateAsync({
        id: marketer.id,
        reason: reason.trim(),
        confirmPhrase: confirmPhrase.trim(),
      });
      toast({
        title: "Account permanently deleted",
        description: result.warnings?.join(" "),
      });
      setReason("");
      setConfirmPhrase("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not permanently delete account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently Delete Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-semibold">THIS CANNOT BE UNDONE — DATA IS GONE, NOT ARCHIVED</p>
            <p className="mt-2">Permanently deleting this account will remove:</p>
            <ul className="ml-4 list-disc">
              <li>The account itself and its login (cannot sign in again, ever)</li>
              <li>All visits, follow-ups, and monthly performance records</li>
              <li>All notifications and account action / approval history for this marketer</li>
              <li>Uploaded documents and profile photo</li>
            </ul>
            <p className="mt-2">Assigned companies will be unassigned, not deleted.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for permanent deletion *</label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type &quot;{CONFIRM_PHRASE}&quot; to confirm *</label>
            <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit || purgeMarketer.isPending}>
            {purgeMarketer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Permanently Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
