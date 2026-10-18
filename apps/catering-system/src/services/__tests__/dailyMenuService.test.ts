import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// Daily menus (data-readiness Phase 3, Step 8): every new or edited dish must
// be a recipe. An old free-text dish (no recipeId) may only be saved again
// unchanged.

const fromMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) },
}));

let stored: any[];
let upserted: any[] | null;

const menu = (recipes: any[]) => ({
  order_id: 'ORD-00001',
  event_id: 'EVT-00001',
  menu_date: '2026-10-18',
  region: 'Dar es Salaam' as const,
  recipes,
});

beforeEach(() => {
  fromMock.mockReset();
  stored = [];
  upserted = null;
  fromMock.mockImplementation((table: string) => {
    if (table !== 'daily_menus') throw new Error(`unexpected table ${table}`);
    const builder = mockQueryResult({ data: stored, error: null });
    builder.upsert = vi.fn((rows: any) => {
      upserted = Array.isArray(rows) ? rows : [rows];
      return mockQueryResult({ data: upserted[0], error: null });
    });
    return builder;
  });
});

describe('bulkUpsertDailyMenus', () => {
  it('rejects a new dish without a recipe and saves nothing', async () => {
    const { bulkUpsertDailyMenus, UnlinkedDishError } = await import('../dailyMenuService');
    const save = bulkUpsertDailyMenus([menu([
      { rowIndex: 1, name: 'Mandazi', recipeId: 'RN-00010' },
      { rowIndex: 2, name: 'chapati special' },
    ])]);
    await expect(save).rejects.toBeInstanceOf(UnlinkedDishError);
    await expect(save).rejects.toThrow(/chapati special/);
    expect(upserted).toBeNull();
  });

  it('saves dishes that all have a recipe', async () => {
    const { bulkUpsertDailyMenus } = await import('../dailyMenuService');
    const ok = await bulkUpsertDailyMenus([menu([{ rowIndex: 1, name: 'Mandazi', recipeId: 'RN-00010', note: 'no sugar' }])]);
    expect(ok).toBe(true);
    expect(upserted?.[0].recipes).toEqual([{ rowIndex: 1, name: 'Mandazi', recipeId: 'RN-00010', note: 'no sugar' }]);
  });

  it('accepts an old free-text dish saved again unchanged, even on another row', async () => {
    stored = [{ event_id: 'EVT-00001', menu_date: '2026-10-18', recipes: [{ rowIndex: 3, name: 'Chapati special' }] }];
    const { bulkUpsertDailyMenus } = await import('../dailyMenuService');
    const ok = await bulkUpsertDailyMenus([menu([{ rowIndex: 2, name: 'chapati special ' }])]);
    expect(ok).toBe(true);
    expect(upserted).not.toBeNull();
  });

  it('rejects an old free-text dish once it is edited (its note changed)', async () => {
    stored = [{ event_id: 'EVT-00001', menu_date: '2026-10-18', recipes: [{ rowIndex: 3, name: 'Chapati special' }] }];
    const { bulkUpsertDailyMenus, UnlinkedDishError } = await import('../dailyMenuService');
    await expect(bulkUpsertDailyMenus([menu([{ rowIndex: 3, name: 'Chapati special', note: 'extra' }])]))
      .rejects.toBeInstanceOf(UnlinkedDishError);
    expect(upserted).toBeNull();
  });

  it('does not let one stored free-text dish cover two copies of it', async () => {
    stored = [{ event_id: 'EVT-00001', menu_date: '2026-10-18', recipes: [{ rowIndex: 3, name: 'Chapati special' }] }];
    const { bulkUpsertDailyMenus, UnlinkedDishError } = await import('../dailyMenuService');
    await expect(bulkUpsertDailyMenus([menu([
      { rowIndex: 3, name: 'Chapati special' },
      { rowIndex: 4, name: 'Chapati special' },
    ])])).rejects.toBeInstanceOf(UnlinkedDishError);
  });
});

describe('upsertDailyMenu', () => {
  it('rejects a new dish without a recipe', async () => {
    const { upsertDailyMenu, UnlinkedDishError } = await import('../dailyMenuService');
    await expect(upsertDailyMenu(menu([{ rowIndex: 1, name: 'Free text' }]))).rejects.toBeInstanceOf(UnlinkedDishError);
    expect(upserted).toBeNull();
  });
});
