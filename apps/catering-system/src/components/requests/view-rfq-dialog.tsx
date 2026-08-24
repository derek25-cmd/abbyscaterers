"use client";

import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { fetchRfqDetail, RfqDetailFields, type RfqRecord } from "./rfq-detail-fields";

export function ViewRfqDialog({
  rfqId,
  isOpen,
  setIsOpen,
}: {
  rfqId: string | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const [rfq, setRfq] = useState<RfqRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !rfqId) return;
    setLoading(true);
    setError(null);
    fetchRfqDetail(rfqId)
      .then(setRfq)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load RFQ"))
      .finally(() => setLoading(false));
  }, [isOpen, rfqId]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>RFQ Details</DialogTitle>
          <DialogDescription>{rfqId}</DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {rfq && <RfqDetailFields rfq={rfq} />}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
