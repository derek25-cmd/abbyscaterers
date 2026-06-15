"use client";

import { useAppVersion } from '@/hooks/useAppVersion';
import { RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UpdateBanner() {
  const { updateAvailable, refreshApp } = useAppVersion();

  if (!updateAvailable) return null;

  return (
    <div className="w-full bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between shrink-0 z-50 shadow-md">
      <div className="flex items-center gap-2.5">
        <Zap className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">
          A software update is available.{' '}
          <span className="font-normal opacity-90">
            Please refresh the application to get the latest version and avoid interruptions.
          </span>
        </span>
      </div>
      <Button
        size="sm"
        onClick={refreshApp}
        className="ml-6 shrink-0 bg-white text-amber-600 hover:bg-amber-50 font-bold border border-amber-200 shadow-sm"
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Update Now
      </Button>
    </div>
  );
}
