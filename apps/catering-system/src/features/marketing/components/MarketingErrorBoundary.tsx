"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
}

export class MarketingErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[MarketingErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="font-medium">Something went wrong in the Marketing module.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Try reloading the page. If the problem persists, return to the dashboard.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
            <Button asChild>
              <Link href="/marketing/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
