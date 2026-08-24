
import { LucideIcon } from "lucide-react";
import * as React from 'react';

export declare function StatsCard(props: {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral" | "warning";
  icon: LucideIcon;
  description?: string;
}): React.ReactElement;
