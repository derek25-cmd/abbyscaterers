"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase-client";

/**
 * No pg_cron in this project, so there's no true scheduled midnight
 * trigger for confirmed -> completed. Instead, this runs once per app
 * load (mounted in main-layout, same as UnconfirmedOrdersReminder) and
 * flips any confirmed order whose service period has already ended —
 * self-healing during normal usage rather than exact-at-midnight.
 */
export function CompletePastOrdersSweep() {
  useEffect(() => {
    supabase.rpc("complete_past_orders").then(({ error }) => {
      if (error) console.error("Failed to sweep completed orders:", error);
    });
  }, []);

  return null;
}
