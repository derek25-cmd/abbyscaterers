"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarketersList, useMyMarketingProfile, useVisits,
} from "@/features/marketing/hooks/useMarketingQuery";
import { isManager } from "@/features/marketing/utils/auth";
import { getStageMeta } from "@/features/marketing/utils/pipeline";
import { formatTime, gpsVerificationTag, initials, titleCase } from "@/features/marketing/utils/format";
import { DeleteVisitDialog } from "@/features/marketing/components/dialogs/DeleteVisitDialog";
import type { Visit } from "@/features/marketing/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function staticMapUrl(visits: Visit[]): string | null {
  const points = visits.filter((v) => v.company?.latitude != null && v.company?.longitude != null);
  if (points.length === 0) return null;
  const markers = points.map((v) => `${v.company!.latitude},${v.company!.longitude}`).join("|");
  const lat = points[0].company!.latitude;
  const lng = points[0].company!.longitude;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=12&size=700x260&markers=${markers}`;
}

export default function DailyVisitsPage() {
  const { data: myProfile } = useMyMarketingProfile();
  const manager = Boolean(myProfile && isManager(myProfile.role));
  const { data: marketers } = useMarketersList();

  const [date, setDate] = useState(todayIso());
  const [marketerId, setMarketerId] = useState<string>("all");
  const [visitToDelete, setVisitToDelete] = useState<{ id: string; companyName: string } | null>(null);

  const { data, isLoading } = useVisits({
    date,
    marketerId: manager ? (marketerId !== "all" ? marketerId : undefined) : undefined,
    limit: 100,
  });

  const visits = data?.data ?? [];

  const grouped = useMemo(() => {
    const byMarketer = new Map<string, { marketerId: string; marketerName: string; visits: Visit[] }>();
    for (const visit of visits) {
      const id = visit.marketer?.id ?? visit.marketer_id;
      const name = visit.marketer?.full_name ?? "Unknown";
      if (!byMarketer.has(id)) byMarketer.set(id, { marketerId: id, marketerName: name, visits: [] });
      byMarketer.get(id)!.visits.push(visit);
    }
    return Array.from(byMarketer.values()).sort((a, b) => a.marketerName.localeCompare(b.marketerName));
  }, [visits]);

  const uniqueCompanies = new Set(visits.map((v) => v.company_id)).size;
  const verifiedCount = visits.filter((v) => v.gps_verified).length;
  const mapUrl = staticMapUrl(visits);
  const isToday = date === todayIso();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Daily Visits</h2>
          <p className="text-sm text-muted-foreground">Every company visited by every marketer, day by day.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {manager && (
            <Select value={marketerId} onValueChange={setMarketerId}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All marketers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All marketers</SelectItem>
                {(marketers ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setDate((d) => shiftDate(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" max={todayIso()} />
          <Button size="icon" variant="outline" className="h-9 w-9" disabled={isToday} onClick={() => setDate((d) => shiftDate(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && <Button size="sm" variant="ghost" onClick={() => setDate(todayIso())}>Today</Button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-4">
          <div><p className="text-2xl font-bold">{visits.length}</p><p className="text-xs text-muted-foreground">Visits logged</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4">
          <div><p className="text-2xl font-bold">{uniqueCompanies}</p><p className="text-xs text-muted-foreground">Companies visited</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4">
          <div><p className="text-2xl font-bold">{visits.length ? Math.round((verifiedCount / visits.length) * 100) : 0}%</p><p className="text-xs text-muted-foreground">GPS verified</p></div>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : visits.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No visits logged on this day.</CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {grouped.map((group) => (
              <Card key={group.marketerId}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {initials(group.marketerName)}
                    </span>
                    {group.marketerName}
                    <Badge variant="outline" className="ml-auto">{group.visits.length} visit{group.visits.length === 1 ? "" : "s"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.visits
                    .slice()
                    .sort((a, b) => (a.check_in_time ?? "").localeCompare(b.check_in_time ?? ""))
                    .map((visit) => {
                      const stageMeta = visit.company?.pipeline_stage ? getStageMeta(visit.company.pipeline_stage) : null;
                      const gpsTag = gpsVerificationTag(visit.gps_accuracy_tag);
                      return (
                        <div key={visit.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm">
                          <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                            {visit.check_in_time ? formatTime(visit.check_in_time) : "—"}
                          </span>
                          <Link href={`/marketing/companies/${visit.company_id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                            {visit.company?.name ?? "Unknown company"}
                          </Link>
                          {stageMeta && <Badge className={stageMeta.color}>{stageMeta.label}</Badge>}
                          {visit.purpose && <Badge variant="secondary">{titleCase(visit.purpose)}</Badge>}
                          {visit.outcome && <Badge variant="outline">{titleCase(visit.outcome)}</Badge>}
                          <Badge className={gpsTag.color}>{gpsTag.label}</Badge>
                          {visit.lead_score != null && (
                            <span className="shrink-0 text-xs text-muted-foreground">Score {visit.lead_score}</span>
                          )}
                          {manager && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setVisitToDelete({ id: visit.id, companyName: visit.company?.name ?? "this company" })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Where visits happened</CardTitle></CardHeader>
              <CardContent>
                {mapUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mapUrl} alt="Map of today's visits" className="w-full rounded-md border" />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
                    <MapPin className="h-6 w-6" />
                    No GPS coordinates available for this day&apos;s visits.
                  </div>
                )}
                <Link href="/marketing/map" className="mt-2 block text-center text-xs font-medium text-primary hover:underline">
                  Open live interactive map →
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Marketers active</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {grouped.map((group) => (
                  <div key={group.marketerId} className="flex items-center gap-2 text-sm">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{group.marketerName}</span>
                    <span className="text-xs text-muted-foreground">{group.visits.length}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <DeleteVisitDialog
        open={visitToDelete != null}
        onOpenChange={(open) => { if (!open) setVisitToDelete(null); }}
        visit={visitToDelete}
      />
    </div>
  );
}
