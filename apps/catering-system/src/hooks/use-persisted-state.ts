
"use client";

import { useEffect, useState } from "react";

// Values are wrapped as { v: state } before stringifying so an explicit
// `undefined` (e.g. a date filter the user cleared) round-trips as a stored,
// non-null "{}" rather than being indistinguishable from "never persisted" —
// JSON.stringify drops object properties whose value is undefined.
// Date instances anywhere in the graph are also tagged so they survive the
// round-trip as real Date objects instead of becoming plain strings.
function serialize<T>(value: T): string {
  return JSON.stringify({ v: value }, (_key, val) => {
    if (val instanceof Date) return { __type: "Date", value: val.toISOString() };
    return val;
  });
}

function deserialize<T>(raw: string): T {
  const parsed = JSON.parse(raw, (_key, val) => {
    if (val && typeof val === "object" && val.__type === "Date") return new Date(val.value);
    return val;
  });
  return parsed.v as T;
}

/**
 * Like useState, but persisted to localStorage under `key` so the value
 * survives navigating away and back (e.g. viewing a record then clicking
 * Back), not just component re-renders. Persists until the user changes it
 * back to the default or clears it themselves — there is no automatic expiry.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? defaultValue : deserialize<T>(stored);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serialize(state));
    } catch {
      // Ignore quota/serialization errors — persistence is a nicety, not critical.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state]);

  return [state, setState] as const;
}
