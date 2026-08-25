'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRevealWindow } from '@/hooks/use-reveal-window';
import { SuperAdminGate } from '@/components/admin/super-admin-gate';
import { AuditLogCard, type AuditLogCardData } from '@/components/admin/audit-log-card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PullToRefresh } from '@/components/pwa/pull-to-refresh';
import { SortSheet } from '@/components/pwa/sort-sheet';
import { FilterSheet } from '@/components/pwa/filter-sheet';
import { LoadMoreButton } from '@/components/pwa/load-more-button';
import { SkeletonCards, SkeletonTableRows } from '@/components/pwa/skeleton-list';

type AuditRow = AuditLogCardData;

const ACTOR_TYPES = ['portal', 'staff', 'system'] as const;
type SortValue = 'date_desc' | 'date_asc';

const ACTOR_TYPE_CLASS: Record<string, string> = {
  portal: 'bg-primary/10 text-primary',
  staff: 'bg-secondary',
  system: 'bg-muted text-muted-foreground',
};

function AuditLog() {
  const supabase = useSupabaseClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortValue>('date_desc');

  const query = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_audit_log')
        .select('id, actor_id, actor_type, action, table_name, record_id, note, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as AuditRow[];
    },
  });

  const filtered = useMemo(() => {
    let rows = query.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.action.toLowerCase().includes(q) ||
          (r.table_name ?? '').toLowerCase().includes(q) ||
          (r.record_id ?? '').toLowerCase().includes(q) ||
          (r.actor_id ?? '').toLowerCase().includes(q)
      );
    }
    if (actorFilter.length > 0) {
      rows = rows.filter((r) => actorFilter.includes(r.actor_type));
    }
    return rows;
  }, [query.data, search, actorFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) =>
      sort === 'date_desc' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)
    );
    return rows;
  }, [filtered, sort]);

  const { visibleItems, hasMore, loadMore } = useRevealWindow(sorted, 20);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Approvals, rejections, request fulfillments, and access changes. Most recent 200 entries.
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by action, table, record, or actor…"
        className="max-w-sm"
      />
      <div className="flex flex-wrap gap-2">
        <SortSheet
          value={sort}
          onChange={setSort}
          options={[
            { value: 'date_desc', label: 'Newest first' },
            { value: 'date_asc', label: 'Oldest first' },
          ]}
        />
        <FilterSheet activeCount={actorFilter.length} onClear={() => setActorFilter([])}>
          {ACTOR_TYPES.map((type) => (
            <div key={type} className="flex items-center gap-2 rounded-md p-2">
              <Checkbox
                id={`actor-type-${type}`}
                checked={actorFilter.includes(type)}
                onCheckedChange={(checked) =>
                  setActorFilter((prev) => (checked ? [...prev, type] : prev.filter((t) => t !== type)))
                }
              />
              <Label htmlFor={`actor-type-${type}`} className="font-normal capitalize">
                {type}
              </Label>
            </div>
          ))}
        </FilterSheet>
      </div>

      {query.isLoading ? (
        isMobile ? <SkeletonCards /> : (
          <Table>
            <TableBody><SkeletonTableRows columns={5} /></TableBody>
          </Table>
        )
      ) : (
        <PullToRefresh onRefresh={async () => { await query.refetch(); }}>
          {isMobile ? (
            <div className="space-y-2">
              {visibleItems.map((r) => (
                <AuditLogCard key={r.id} entry={r} />
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No audit entries match &quot;{search}&quot;.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`mr-1 ${ACTOR_TYPE_CLASS[r.actor_type]}`}>
                        {r.actor_type}
                      </Badge>
                      <span className="font-mono text-xs">{r.actor_id ?? '—'}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.action}</TableCell>
                    <TableCell className="text-xs">
                      {r.table_name ? (
                        <>
                          {r.table_name}
                          {r.record_id ? `:${r.record_id}` : ''}
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.note ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No audit entries match &quot;{search}&quot;.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {hasMore && <div className="pt-2"><LoadMoreButton onClick={loadMore} /></div>}
        </PullToRefresh>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <SuperAdminGate>
      <AuditLog />
    </SuperAdminGate>
  );
}
