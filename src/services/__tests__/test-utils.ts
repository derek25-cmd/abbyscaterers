import { vi } from 'vitest';

/**
 * A minimal chainable mock of the Supabase query builder. Every chain
 * method (select/insert/update/delete/eq/order/range/etc.) returns the same
 * object so `.a().b().c()` chains of any shape resolve to `result` when
 * awaited — PostgrestFilterBuilder is itself a thenable, so real code that
 * does `await supabase.from(...).select().eq()` works against this without
 * needing to know the exact chain shape in advance.
 */
export function mockQueryResult(result: { data: any; error: any; count?: number }) {
  const builder: any = {
    then: (resolve: (value: any) => void) => resolve(result),
  };
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'is',
    'order', 'range', 'limit', 'single', 'maybeSingle', 'not', 'gte', 'lte',
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}
