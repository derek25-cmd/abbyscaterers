
"use client";

import { Loader2, Sparkles } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface BulkOrderLoadingProps {
    progress: {
        current: number;
        total: number;
    };
}

export function BulkOrderLoading({ progress }: BulkOrderLoadingProps) {
    const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
        <div className="w-full max-w-md p-8 text-center space-y-4 bg-card shadow-xl rounded-lg">
            <div className="relative w-24 h-24 mx-auto">
                <Loader2 className="h-24 w-24 animate-spin text-primary opacity-30" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-primary-glow animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Creating Orders...</h1>
            <p className="text-muted-foreground text-lg">
                Please wait while we generate the daily orders for you.
            </p>
            <div className="space-y-2 pt-2">
                <Progress value={percentage} className="w-full" />
                <p className="text-sm text-muted-foreground font-mono">
                    {progress.current} / {progress.total}
                </p>
            </div>
        </div>
    </div>
  );
}
