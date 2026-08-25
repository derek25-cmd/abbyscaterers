'use client';

import { useCallback, useEffect, useState } from 'react';
import { getExistingPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/push-notifications';

const VISIT_COUNT_KEY = 'abbys-admin-visit-count';
const PROMPT_DISMISSED_KEY = 'abbys-admin-push-prompt-dismissed';
const PROMPT_AFTER_VISITS = 3;

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContextualPrompt, setShowContextualPrompt] = useState(false);

  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(isSupported);
    if (!isSupported) return;

    setPermission(Notification.permission);
    getExistingPushSubscription().then((sub) => setSubscribed(!!sub));

    // Contextual prompt: don't ask on first visit — count visits in
    // localStorage and only offer after a few, and only if the user hasn't
    // already answered (permission is still 'default') or dismissed it before.
    try {
      const count = Number(localStorage.getItem(VISIT_COUNT_KEY) ?? '0') + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(count));
      const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY) === 'true';
      if (Notification.permission === 'default' && !dismissed && count >= PROMPT_AFTER_VISITS) {
        setShowContextualPrompt(true);
      }
    } catch {
      // localStorage unavailable (private mode etc.) — just skip the prompt.
    }
  }, []);

  const enable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await subscribeToPush();
      setSubscribed(true);
      setPermission(Notification.permission);
      setShowContextualPrompt(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissContextualPrompt = useCallback(() => {
    setShowContextualPrompt(false);
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  return { supported, permission, subscribed, loading, error, showContextualPrompt, enable, disable, dismissContextualPrompt };
}
