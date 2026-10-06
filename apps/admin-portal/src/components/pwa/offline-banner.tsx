'use client';

import { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    setOffline(!navigator.onLine);

    const handleOffline = () => {
      setOffline(true);
      wasOffline.current = true;
    };
    const handleOnline = () => {
      setOffline(false);
      if (wasOffline.current) {
        toast({ title: 'Back online', description: 'Syncing…' });
        wasOffline.current = false;
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      role="status"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You&apos;re offline — showing cached data</span>
    </div>
  );
}
