"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase-client";
import type { Order } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, X, Loader2 } from "lucide-react";

/**
 * Wall-clock hour/minute in EAT (UTC+3, no DST), computed via UTC
 * arithmetic rather than the browser's local timezone — so this fires
 * correctly regardless of what timezone a staff member's OS is set to.
 */
function getEatWallClock(date: Date = new Date()) {
  const utcTotalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  let eatTotalMinutes = utcTotalMinutes + 3 * 60;
  let dayOffset = 0;
  if (eatTotalMinutes >= 24 * 60) {
    eatTotalMinutes -= 24 * 60;
    dayOffset = 1;
  }
  const hours = Math.floor(eatTotalMinutes / 60);
  const minutes = eatTotalMinutes % 60;
  const eatDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + dayOffset));
  return { hours, minutes, todayEat: format(eatDate, "yyyy-MM-dd") };
}

/**
 * From exactly 5:00pm EAT, checks every 10 minutes (on the actual :00/:10/
 * :20... EAT marks, not just "10 minutes after mount") whether any order
 * covering tomorrow (EAT) is still status = 'pending_confirmation'. If so,
 * pops a dialog to confirm or cancel each one. Polls every 60s (rather than
 * scheduling exactly on the minute) so it's robust to tab throttling/
 * backgrounding — a minute-mark dedupe guard prevents firing twice for the
 * same mark if a check lands a few seconds late.
 */
export function UnconfirmedOrdersReminder() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const lastFiredMarkRef = useRef<string | null>(null);

  const checkForUnconfirmedOrders = useCallback(async () => {
    const { hours, minutes, todayEat } = getEatWallClock();
    if (hours < 17) return; // never fires before 5:00pm EAT

    const minutesSince5pm = (hours - 17) * 60 + minutes;
    if (minutesSince5pm % 10 !== 0) return; // only on exact 10-minute marks

    const mark = `${todayEat}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    if (lastFiredMarkRef.current === mark) return;
    lastFiredMarkRef.current = mark;

    const tomorrowEat = format(addDays(parseISO(todayEat), 1), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending_confirmation")
      .lte("start_date", tomorrowEat)
      .gte("end_date", tomorrowEat);

    if (error) {
      console.error("Error checking for unconfirmed orders:", error);
      return;
    }
    if (data && data.length > 0) {
      setOrders(data as unknown as Order[]);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    checkForUnconfirmedOrders();
    const interval = setInterval(checkForUnconfirmedOrders, 60_000);
    return () => clearInterval(interval);
  }, [checkForUnconfirmedOrders]);

  const resolveOrder = async (orderId: string, status: "confirmed" | "cancelled") => {
    setActingOnId(orderId);
    try {
      const { error } = await supabase.from("orders").update({ status, updatedAt: new Date().toISOString() }).eq("id", orderId);
      if (error) throw error;
      setOrders((prev) => {
        const next = prev.filter((o) => o.id !== orderId);
        if (next.length === 0) setOpen(false);
        return next;
      });
    } catch (err) {
      console.error("Error resolving order confirmation:", err);
    } finally {
      setActingOnId(null);
    }
  };

  if (orders.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Unconfirmed orders for tomorrow
          </DialogTitle>
          <DialogDescription>
            These orders cover tomorrow&apos;s date and are still pending confirmation. Confirm or
            cancel each one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">{order.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {order.id} · {order.startDate} – {order.endDate}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actingOnId === order.id}
                  onClick={() => resolveOrder(order.id, "cancelled")}
                >
                  {actingOnId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                  Cancel
                </Button>
                <Button size="sm" disabled={actingOnId === order.id} onClick={() => resolveOrder(order.id, "confirmed")}>
                  {actingOnId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Confirm
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
