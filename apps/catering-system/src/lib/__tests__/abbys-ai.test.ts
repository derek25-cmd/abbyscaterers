import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dishCostPerPlate, estimateMenuCost, verdictText, type DishCost, type QuoteCheckResult } from '../abbys-ai';

const costs = new Map<string, DishCost>([
  ['salad', { dish_key: 'salad', meal_section: 'Lunch', cost_per_plate: 900, model_run: 'r1' }],
  ['beef roast', { dish_key: 'beef roast', meal_section: 'Lunch', cost_per_plate: 1500, model_run: 'r1' }],
  ['other lunch dish', { dish_key: 'other lunch dish', meal_section: 'Lunch', cost_per_plate: 300, model_run: 'r1' }],
]);

describe('dishCostPerPlate', () => {
  it('uses the dish cost, case-insensitively', () => {
    expect(dishCostPerPlate(' Salad ', 'Lunch', costs)).toEqual({ cost: 900, pooled: false });
  });
  it("falls back to the section's pooled cost", () => {
    expect(dishCostPerPlate('ugali', 'Lunch', costs)).toEqual({ cost: 300, pooled: true });
  });
  it('is unknown when neither exists', () => {
    expect(dishCostPerPlate('mandazi', 'Breakfast', costs)).toEqual({ cost: null, pooled: false });
  });
});

describe('estimateMenuCost', () => {
  it('adds dish costs and takes VAT out of the price before the margin', () => {
    const est = estimateMenuCost(
      [{ dish: 'salad', section: 'Lunch' }, { dish: 'beef roast', section: 'Lunch' }, { dish: 'ugali', section: 'Lunch' }],
      costs, 11800, 50,
    );
    expect(est.costPerPlate).toBe(2700);
    expect(est.priceExVat).toBe(10000);
    expect(est.foodCostPct).toBe(27);
    expect(est.marginPerPlate).toBe(7300);
    expect(est.totalCost).toBe(135000);
    expect(est.totalMargin).toBe(365000);
  });
  it('keeps the price as is when it excludes VAT, and lists unknown dishes', () => {
    const est = estimateMenuCost([{ dish: 'salad', section: 'Lunch' }, { dish: 'mandazi', section: 'Breakfast' }], costs, 10000, null, false);
    expect(est.priceExVat).toBe(10000);
    expect(est.costPerPlate).toBe(900);
    expect(est.unknownDishes).toEqual(['mandazi']);
    expect(est.totalMargin).toBeNull();
  });
  it('has no margin without a price', () => {
    const est = estimateMenuCost([{ dish: 'salad', section: 'Lunch' }], costs, null, 10);
    expect(est.marginPerPlate).toBeNull();
    expect(est.foodCostPct).toBeNull();
    expect(est.totalCost).toBe(9000);
  });
});

const quote = (over: Partial<QuoteCheckResult>): QuoteCheckResult => ({
  meal: 'lunch', expected_price: 12000, expected_band: 'C 11-15k', expected_from: 'client_same_meal',
  market_median: 12000, same_meal: null, client_events: 10, recent: [], price: 9000, price_band: 'B 6-11k',
  diff_pct: -0.25, verdict: 'low', ...over,
});

describe('verdictText', () => {
  it('warns about a low quote', () => {
    expect(verdictText(quote({}))).toMatchObject({ tone: 'warn', title: '25% below expected' });
  });
  it('says a quote within 10% is in line', () => {
    expect(verdictText(quote({ price: 12500, diff_pct: 0.042, verdict: 'ok' })).tone).toBe('ok');
  });
  it('mentions when a new client is compared with the market', () => {
    expect(verdictText(quote({ expected_from: 'market' })).detail).toMatch(/New client/);
  });
  it('asks for a price when none was given', () => {
    expect(verdictText(quote({ price: null, diff_pct: null, verdict: null })).tone).toBe('info');
  });
});

// The service passes the right arguments to the database functions.
const rpcMock = vi.fn();
vi.mock('@/lib/supabase-client', () => ({ supabase: { rpc: (...a: any[]) => rpcMock(...a), from: vi.fn() } }));

describe('abbysAiService', () => {
  beforeEach(() => rpcMock.mockReset());

  it('calls abby_ai_quote_check with client, meal type and price', async () => {
    rpcMock.mockResolvedValue({ data: quote({}), error: null });
    const { checkQuote } = await import('@/services/abbysAiService');
    const r = await checkQuote('000712', 'Lunch only', 9000);
    expect(rpcMock).toHaveBeenCalledWith('abby_ai_quote_check', { p_client_id: '000712', p_meal_type: 'Lunch only', p_price: 9000 });
    expect(r.verdict).toBe('low');
  });

  it('turns menu idea shares into numbers', async () => {
    rpcMock.mockResolvedValue({ data: [{ section: 'Lunch', dish_key: 'salad', recipe_id: 'RN-1', recipe_name: 'Salad', events: 9, share: '0.87', band_share: null, score: '0.87' }], error: null });
    const { getMenuIdeas } = await import('@/services/abbysAiService');
    const rows = await getMenuIdeas('Lunch only', 12000, 5);
    expect(rpcMock).toHaveBeenCalledWith('abby_ai_menu_ideas', { p_meal_type: 'Lunch only', p_price: 12000, p_limit: 5 });
    expect(rows[0]).toMatchObject({ share: 0.87, band_share: null, score: 0.87 });
  });

  it('raises the database error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Not allowed' } });
    const { checkQuote } = await import('@/services/abbysAiService');
    await expect(checkQuote('x', 'Lunch', null)).rejects.toThrow('Not allowed');
  });
});
