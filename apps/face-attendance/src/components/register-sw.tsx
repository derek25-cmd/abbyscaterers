'use client';

import { useEffect } from 'react';

// Production only: in development a cached shell would hide code changes.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
      console.error('Service worker registration failed:', err);
    });
  }, []);
  return null;
}
