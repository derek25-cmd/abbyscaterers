"use client";

import { useMarketingRealtime } from "../hooks/useMarketingQuery";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useMarketingRealtime();
  return <>{children}</>;
}
