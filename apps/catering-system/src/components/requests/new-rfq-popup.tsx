"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchRfqDetail, RfqDetailFields, type RfqRecord } from "./rfq-detail-fields";

// Mounted once, globally, in main-layout.tsx next to <UnconfirmedOrdersReminder />
// — same "proactive Dialog fired by data, not a click" shape.
const DISMISSED_KEY = "catering-system:dismissed-rfq-popups";

function getDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function addDismissed(id: string) {
  try {
    const next = getDismissed();
    next.add(id);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  } catch {
    // best-effort only — worst case an already-answered RFQ pops again once
  }
}

export function NewRfqPopup() {
  const router = useRouter();
  const [queue, setQueue] = useState<string[]>([]);
  const [current, setCurrent] = useState<RfqRecord | null>(null);
  const [open, setOpen] = useState(false);
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const openingRef = useRef(false);

  const enqueue = (id: string) => {
    if (queuedIdsRef.current.has(id) || getDismissed().has(id)) return;
    queuedIdsRef.current.add(id);
    setQueue((q) => [...q, id]);
  };

  // Catch-up on mount: submitted RFQs nobody has answered (linked a
  // proforma to) yet, so a staff member who was offline when one arrived
  // still sees it once they load the app.
  useEffect(() => {
    supabase
      .from("rfqs")
      .select("id, rfq_proforma_links(proforma_id)")
      .eq("status", "submitted")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) return;
        (data as unknown as { id: string; rfq_proforma_links: { proforma_id: string }[] }[])
          .filter((r) => r.rfq_proforma_links.length === 0)
          .forEach((r) => enqueue(r.id));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live: an RFQ that just became 'submitted'. Relies on rfqs having
  // REPLICA IDENTITY FULL (supabase/migrations/20260901120000_*.sql) so
  // payload.old carries the previous status, not just the primary key —
  // otherwise every unrelated update to an already-submitted RFQ would
  // re-pop it.
  useEffect(() => {
    const channel = supabase
      .channel("new-rfq-popup")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rfqs" }, (payload) => {
        const row = payload.new as { id: string; status: string };
        if (row.status === "submitted") enqueue(row.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rfqs" }, (payload) => {
        const row = payload.new as { id: string; status: string };
        const prev = payload.old as { status?: string };
        if (row.status === "submitted" && prev.status !== "submitted") enqueue(row.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the next queued RFQ whenever nothing is currently showing.
  useEffect(() => {
    if (open || openingRef.current || queue.length === 0) return;
    openingRef.current = true;
    const [nextId, ...rest] = queue;
    setQueue(rest);
    fetchRfqDetail(nextId)
      .then((rfq) => {
        setCurrent(rfq);
        setOpen(true);
      })
      .catch(() => {
        // Deleted or otherwise unfetchable between enqueue and now — skip it.
      })
      .finally(() => {
        openingRef.current = false;
      });
  }, [open, queue]);

  const dismiss = () => {
    if (current) addDismissed(current.id);
    setOpen(false);
    setCurrent(null);
  };

  const viewInRequests = () => {
    if (current) addDismissed(current.id);
    setOpen(false);
    setCurrent(null);
    router.push("/requests");
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New RFQ from the Admin Portal</DialogTitle>
          <DialogDescription>{current.id}</DialogDescription>
        </DialogHeader>
        <RfqDetailFields rfq={current} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={dismiss}>
            Dismiss
          </Button>
          <Button type="button" onClick={viewInRequests}>
            View in Requests
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
