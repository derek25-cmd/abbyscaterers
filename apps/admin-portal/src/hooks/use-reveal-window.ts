'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side "load more" pagination over an already-fetched array — see
 * the Phase 2 plan for why this isn't a real server-side .range() query
 * (deferred to the Performance phase). Resets to the first page whenever
 * the input array is a new reference, which happens naturally whenever the
 * caller's search/sort/filter useMemo recomputes it.
 */
export function useRevealWindow<T>(items: T[], pageSize = 20) {
  const [count, setCount] = useState(pageSize);

  useEffect(() => {
    setCount(pageSize);
  }, [items, pageSize]);

  return {
    visibleItems: items.slice(0, count),
    hasMore: count < items.length,
    loadMore: () => setCount((c) => c + pageSize),
  };
}
