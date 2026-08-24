'use client';

import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

export function useAppVersion() {
  const baselineBuildId = useRef<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkVersion = async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const { buildId } = await res.json();

      if (baselineBuildId.current === null) {
        // First call on mount — record as the baseline (current running version).
        baselineBuildId.current = buildId;
      } else if (buildId !== 'dev' && buildId !== baselineBuildId.current) {
        // The server is now serving a different build — a deployment happened.
        setUpdateAvailable(true);
      }
    } catch {
      // Network error or ad-blocker — silently skip.
    }
  };

  useEffect(() => {
    checkVersion();
    const timer = setInterval(checkVersion, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshApp = () => window.location.reload();

  return { updateAvailable, refreshApp };
}
