"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            This page ran into a problem. Your data is safe — try again, or head back to the dashboard.
          </p>
          {error?.message && (
            <p className="text-xs font-mono text-muted-foreground/70 bg-muted rounded px-3 py-2 mt-3 break-all">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <a href="/dashboard">Back to Dashboard</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
