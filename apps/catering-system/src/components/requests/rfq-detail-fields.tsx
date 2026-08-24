"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";

// Mirrors apps/admin-portal/src/components/rfq/rfq-detail.tsx's RfqRecord —
// duplicated rather than imported, since apps/catering-system doesn't
// depend on @abbyscaterers/types (same "duplicate, don't cross-import"
// convention the RFQ tables' own migration comment establishes).
export interface PaxPerDayEntry {
  date: string;
  pax: number;
}

export interface MealTypePerDayEntry {
  date: string;
  mealType: string;
}

export interface RfqRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  client_id: string | null;
  client_name_freetext: string | null;
  clients: { companyName: string } | null;
  service_start_date: string | null;
  service_end_date: string | null;
  target_event_date: string | null;
  proforma_required_by: string | null;
  same_pax_all_dates: boolean;
  pax_per_day: PaxPerDayEntry[] | null;
  same_meal_type_all_dates: boolean;
  meal_type_per_day: MealTypePerDayEntry[] | null;
  rate_per_plate: number | null;
  vat_type: "inclusive" | "exclusive" | null;
  location: string | null;
  region: string | null;
  branch: string | null;
}

export async function fetchRfqDetail(rfqId: string): Promise<RfqRecord> {
  const { data, error } = await supabase
    .from("rfqs")
    .select("*, clients(companyName)")
    .eq("id", rfqId)
    .single();
  if (error) throw error;
  return data as unknown as RfqRecord;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-start gap-4 py-1.5">
      <Label className="text-right text-muted-foreground font-normal">{label}</Label>
      <span className="col-span-2 text-sm">{value ?? "—"}</span>
    </div>
  );
}

export function RfqDetailFields({ rfq }: { rfq: RfqRecord }) {
  const pax =
    rfq.pax_per_day && rfq.pax_per_day.length > 0
      ? rfq.same_pax_all_dates
        ? `${rfq.pax_per_day[0].pax} / day (all dates)`
        : `${rfq.pax_per_day.reduce((s, p) => s + p.pax, 0)} total, varies by day`
      : "—";

  const mealType =
    rfq.meal_type_per_day && rfq.meal_type_per_day.length > 0
      ? rfq.same_meal_type_all_dates
        ? rfq.meal_type_per_day[0].mealType
        : "Varies by day"
      : "—";

  return (
    <div className="text-sm">
      <DetailRow label="Client" value={rfq.clients?.companyName ?? rfq.client_name_freetext ?? rfq.client_id} />
      <DetailRow
        label="Service period"
        value={
          rfq.service_start_date && rfq.service_end_date
            ? `${rfq.service_start_date} – ${rfq.service_end_date}`
            : rfq.target_event_date
        }
      />
      <DetailRow label="Proforma required by" value={rfq.proforma_required_by} />
      <DetailRow label="Pax" value={pax} />
      <DetailRow label="Meal type" value={mealType} />
      <DetailRow
        label="Rate per plate"
        value={rfq.rate_per_plate != null ? `TZS ${rfq.rate_per_plate.toLocaleString()}` : null}
      />
      <DetailRow label="VAT" value={rfq.vat_type} />
      <DetailRow label="Location" value={rfq.location} />
      <DetailRow label="Region" value={rfq.region} />
      {rfq.description && <DetailRow label="Notes" value={rfq.description} />}
    </div>
  );
}
