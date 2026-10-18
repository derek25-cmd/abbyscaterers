import { supabase } from '@/lib/supabase-client';

// Data Quality page (data-readiness Phase 3, Step 7). Read-only: lists the
// events returned by event_quality_issues() and looks up a suggested fix.

export const EVENT_ISSUE_TYPES = [
  'no date',
  'pax <= 0',
  'unit price = 0',
  'no menu',
  'no meal type',
  'date outside order dates',
  'duplicate event id',
  'recipe id not found',
] as const;

export type EventIssueType = (typeof EVENT_ISSUE_TYPES)[number];

export interface EventIssue {
  order_id: string;
  client_id: string | null;
  order_status: string | null;
  event_id: string | null;
  event_date: string | null;
  issues: string[];
}

export interface EventFixSuggestion {
  /** Pax and price from the invoice line for the event, or the proforma if not invoiced yet. */
  pax?: number | null;
  unitPrice?: number | null;
  source?: { kind: 'invoice' | 'proforma'; id: string };
  /** Dishes on the event's daily menus whose recipeId is not a known recipe. */
  unknownRecipeDishes?: string[];
}

export const getEventIssues = async (): Promise<EventIssue[]> => {
  const { data, error } = await supabase.rpc('event_quality_issues');
  if (error) throw new Error(error.message);
  return (data || []) as EventIssue[];
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

async function findDocumentLine(table: 'invoices' | 'proforma_invoices', eventId: string) {
  const { data, error } = await supabase
    .from(table)
    .select('id, items')
    .contains('items', [{ id: eventId }])
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const doc = data[0] as { id: string; items: unknown };
  const line = Array.isArray(doc.items) ? (doc.items as any[]).find(i => i && i.id === eventId) : undefined;
  return line ? { id: doc.id, pax: num(line.pax), unitPrice: num(line.unitPrice) } : null;
}

/**
 * Suggested fixes, keyed by event id:
 *   * price or pax issues: the matching invoice line (by event id in
 *     invoices.items), else the proforma line;
 *   * "recipe id not found": the dish names on the event's daily menus
 *     whose recipeId matches no recipe.
 */
export const getEventFixSuggestions = async (rows: EventIssue[]): Promise<Record<string, EventFixSuggestion>> => {
  const out: Record<string, EventFixSuggestion> = {};

  const priceIds = rows
    .filter(r => r.event_id && r.issues.some(i => i === 'pax <= 0' || i === 'unit price = 0'))
    .map(r => r.event_id as string);
  await Promise.all(priceIds.map(async eventId => {
    const inv = await findDocumentLine('invoices', eventId);
    const line = inv ? { ...inv, kind: 'invoice' as const } : await findDocumentLine('proforma_invoices', eventId).then(p => p && { ...p, kind: 'proforma' as const });
    if (line) {
      out[eventId] = { ...out[eventId], pax: line.pax, unitPrice: line.unitPrice, source: { kind: line.kind, id: line.id } };
    }
  }));

  const recipeIds = rows
    .filter(r => r.event_id && r.issues.includes('recipe id not found'))
    .map(r => r.event_id as string);
  if (recipeIds.length > 0) {
    const { data: menus } = await supabase.from('daily_menus').select('event_id, recipes').in('event_id', recipeIds);
    const dishes = new Map<string, { recipeId: string; name: string }[]>();
    for (const m of (menus || []) as { event_id: string; recipes: unknown }[]) {
      for (const d of Array.isArray(m.recipes) ? (m.recipes as any[]) : []) {
        if (d && typeof d.recipeId === 'string' && d.recipeId.trim() !== '') {
          const list = dishes.get(m.event_id) || [];
          list.push({ recipeId: d.recipeId.trim(), name: String(d.name || '').trim() });
          dishes.set(m.event_id, list);
        }
      }
    }
    const allRecipeIds = Array.from(new Set(Array.from(dishes.values()).flat().map(d => d.recipeId)));
    const known = new Set<string>();
    if (allRecipeIds.length > 0) {
      const { data: recipes } = await supabase.from('recipes').select('recipeNumber').in('recipeNumber', allRecipeIds);
      (recipes || []).forEach((r: any) => known.add(r.recipeNumber));
    }
    dishes.forEach((list, eventId) => {
      const unknown = Array.from(new Set(list.filter(d => !known.has(d.recipeId)).map(d => `${d.name || '(no name)'} [${d.recipeId}]`)));
      if (unknown.length > 0) out[eventId] = { ...out[eventId], unknownRecipeDishes: unknown };
    });
  }

  return out;
};

/** One line of text for the "Suggested fix" column and the CSV. */
export function describeSuggestion(s: EventFixSuggestion | undefined): string {
  if (!s) return '';
  const parts: string[] = [];
  if (s.source) {
    parts.push(`${s.source.kind === 'invoice' ? 'Invoice' : 'Proforma'} ${s.source.id}: pax ${s.pax ?? '?'}, unit price ${s.unitPrice ?? '?'}`);
  }
  if (s.unknownRecipeDishes && s.unknownRecipeDishes.length > 0) {
    parts.push(`Re-pick the recipe for: ${s.unknownRecipeDishes.join(', ')}`);
  }
  return parts.join('; ');
}
