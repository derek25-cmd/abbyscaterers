"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { MarketerLeaderboardRow } from "../../types";

export function MarketerLeaderboard({ rows }: { rows: MarketerLeaderboardRow[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Marketer Leaderboard</CardTitle>
        <CardDescription>Performance across the marketing team this period.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Users className="h-8 w-8" />
            <p className="text-sm">No marketer data yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marketer</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Verified</TableHead>
                <TableHead className="text-right">New Leads</TableHead>
                <TableHead className="text-right">Deals Won</TableHead>
                <TableHead className="text-right">Avg Lead Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.marketerId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Badge>Top</Badge>}
                      {row.marketerName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{row.totalVisits}</TableCell>
                  <TableCell className="text-right">{row.verifiedVisits}</TableCell>
                  <TableCell className="text-right">{row.newLeads}</TableCell>
                  <TableCell className="text-right">{row.dealsWon}</TableCell>
                  <TableCell className="text-right">{row.avgLeadScore}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
