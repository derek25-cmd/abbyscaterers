"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getStageMeta } from "@/features/marketing/utils/pipeline";
import { formatDate } from "@/features/marketing/utils/format";
import { authedFetch } from "@/features/marketing/api/authed-fetch";
import type { Company, MarketingUser, Visit } from "@/features/marketing/types";

interface MarketerDetail extends MarketingUser {
  region?: { id: string; name: string } | null;
  visits: (Visit & { company?: Pick<Company, "id" | "name"> })[];
  companies: Company[];
}

export default function MarketerDetailPage() {
  const params = useParams<{ id: string }>();
  const [marketer, setMarketer] = useState<MarketerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    authedFetch(`/api/marketing/marketers/${params.id}`)
      .then((res) => res.json())
      .then((body) => { if (active) setMarketer(body.data ?? null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!marketer) {
    return <div className="py-16 text-center text-muted-foreground">Marketer not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/marketing/marketers" className="hover:text-foreground">Marketers</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{marketer.full_name}</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold">{marketer.full_name}</h2>
        <p className="text-sm text-muted-foreground">{marketer.email} · {marketer.region?.name ?? "No region"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Assigned Companies ({marketer.companies.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {marketer.companies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No companies assigned.</p>
            ) : (
              marketer.companies.map((company) => (
                <div key={company.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <Link href={`/marketing/companies/${company.id}`} className="hover:underline">{company.name}</Link>
                  <Badge className={getStageMeta(company.pipeline_stage).color}>{getStageMeta(company.pipeline_stage).label}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Visits</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {marketer.visits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits logged yet.</p>
            ) : (
              marketer.visits.slice(0, 10).map((visit) => (
                <div key={visit.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{visit.company?.name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{visit.check_in_time ? formatDate(visit.check_in_time) : "—"}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
