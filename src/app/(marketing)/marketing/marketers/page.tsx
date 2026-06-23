"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketers } from "@/features/marketing/hooks/useMarketingQuery";
import { MarketerForm } from "@/features/marketing/components/forms/MarketerForm";
import { MarketerAccountTable } from "@/features/marketing/components/tables/MarketerAccountTable";
import { getTierFromScore } from "@/features/marketing/utils/lead-score";
import { formatTZS, initials } from "@/features/marketing/utils/format";

export default function MarketersPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useMarketers(month, year);
  const rows = data?.data ?? [];
  const teamRevenue = rows.reduce((sum, r) => sum + r.revenueGenerated, 0);
  const topVisitsId = rows.length ? [...rows].sort((a, b) => b.totalVisits - a.totalVisits)[0].marketerId : undefined;

  const monthValue = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Marketing Team</h2>
        <Button onClick={() => setFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Marketer</Button>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="accounts">Account Management</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <input
              type="month"
              value={monthValue}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setYear(y);
                setMonth(m);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No marketer data yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => {
            const tier = getTierFromScore(row.avgLeadScore);
            const isTop = row.marketerId === topVisitsId && row.totalVisits > 0;
            const revenueShare = teamRevenue > 0 ? Math.round((row.revenueGenerated / teamRevenue) * 100) : 0;

            return (
              <Card key={row.marketerId}>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Avatar className={isTop ? "bg-primary" : ""}>
                    <AvatarFallback className={isTop ? "bg-primary text-primary-foreground" : ""}>{initials(row.marketerName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{row.marketerName}</p>
                      {isTop && <Trophy className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{row.region ?? "No region"}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div><p className="font-semibold">{row.totalVisits}</p><p className="text-xs text-muted-foreground">Visits</p></div>
                    <div><p className="font-semibold">{row.newLeads}</p><p className="text-xs text-muted-foreground">Leads</p></div>
                    <div><p className="font-semibold">{row.quotationsRequested}</p><p className="text-xs text-muted-foreground">Quotes</p></div>
                    <div><p className="font-semibold">{row.dealsWon}</p><p className="text-xs text-muted-foreground">Deals</p></div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Revenue</span>
                      <span>{formatTZS(row.revenueGenerated, { compact: true })}</span>
                    </div>
                    <Progress value={revenueShare} />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Avg lead score</span>
                    <Badge variant="outline" className={tier.color}>{row.avgLeadScore} · {tier.label}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Follow-up completion</span>
                    <span className="font-medium">{row.followUpRate}%</span>
                  </div>

                  <Link href={`/marketing/marketers/${row.marketerId}`} className="block text-center text-sm text-primary hover:underline">
                    View Details
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="accounts" className="pt-4">
          <MarketerAccountTable />
        </TabsContent>
      </Tabs>

      <MarketerForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
