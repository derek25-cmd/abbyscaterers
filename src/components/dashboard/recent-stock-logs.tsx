
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { StockLog } from "@/types";
import { format, parseISO } from "date-fns";

interface RecentStockLogsProps {
  logs: StockLog[];
}

export function RecentStockLogs({ logs }: RecentStockLogsProps) {
  const recentLogs = logs.slice(0, 5);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Recent Stock Movements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No recent movements.</p>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full",
                    log.type === 'Stock In' ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                  )}>
                    {log.type === 'Stock In' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{log.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.reason} • {format(parseISO(log.date), "MMM d")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-bold",
                    log.type === 'Stock In' ? "text-green-600" : "text-red-600"
                  )}>
                    {log.type === 'Stock In' ? "+" : "-"}{log.quantity}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { cn } from "@/lib/utils";
