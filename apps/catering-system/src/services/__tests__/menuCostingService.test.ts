import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// calculateMenuCost (data-readiness Phase 2, Step 5): recipe lines link to the
// product catalog (line.productId). Each line is priced at the chosen branch's
// price for its product, converted with toPriceUnit, and never added at zero;
// what cannot be priced goes to missingPrices.

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
    rpc: (...args: any[]) => rpcMock(...args),
  },
}));

const MENU = { id: 'M1', name: 'Test lunch', base_people: 10, price_per_person: 10000, menu_types: { name: 'lunch' } };

const baseRecipe = () => ({
  recipeNumber: 'RN-1',
  recipeName: 'Pilau plate',
  ingredients: [
    { productId: 'P-RICE', quantity: 2, unit: 'kg' },        // priced kg product
    { productId: 'P-SPICE', quantity: 1, unit: 'kg' },       // product priced 0 everywhere
    { productId: 'P-OIL', quantity: 1, unit: 'liters' },     // priced at Dar, 0 at Arusha
    { productId: 'P-SALT', quantity: 500, unit: 'gms' },     // gms line, kg-priced product
    { productId: 'P-EGG', quantity: 6, unit: 'item' },       // pieces vs kg, no grams_per_item
  ] as any[],
});

let recipe: ReturnType<typeof baseRecipe>;
let products: any[];
let menuRecipes: any[];
let recipesRows: any[];
let plannedInserted: any[] | null;

const baseProducts = () => [
  { id: 'P-RICE', name: 'Rice', unit: 'kg', base_unit: 'kg', grams_per_item: null, unitPrice_dar: 3000, unitPrice_arusha: 3500, unitPrice_dodoma: 0 },
  { id: 'P-SPICE', name: 'Mystery spice', unit: 'kg', base_unit: 'kg', grams_per_item: null, unitPrice_dar: 0, unitPrice_arusha: 0, unitPrice_dodoma: 0 },
  { id: 'P-OIL', name: 'Cooking oil', unit: 'liters', base_unit: 'liters', grams_per_item: null, unitPrice_dar: 5000, unitPrice_arusha: 0, unitPrice_dodoma: 0 },
  { id: 'P-SALT', name: 'Salt', unit: 'kg', base_unit: 'kg', grams_per_item: null, unitPrice_dar: 2000, unitPrice_arusha: 2000, unitPrice_dodoma: 0 },
  { id: 'P-EGG', name: 'Eggs', unit: 'kg', base_unit: 'kg', grams_per_item: null, unitPrice_dar: 8000, unitPrice_arusha: 8000, unitPrice_dodoma: 0 },
];

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  recipe = baseRecipe();
  products = baseProducts();
  menuRecipes = [{ id: 'MR1', menu_id: 'M1', recipe_number: 'RN-1', recipes: { recipeName: 'Pilau plate', recipeType: 'Lunch' } }];
  recipesRows = [recipe];
  plannedInserted = null;
  fromMock.mockImplementation((table: string) => {
    switch (table) {
      case 'catering_menus':
        return mockQueryResult({ data: MENU, error: null });
      case 'catering_menu_recipes':
        return mockQueryResult({ data: menuRecipes, error: null });
      case 'recipes':
        return mockQueryResult({ data: recipesRows, error: null });
      case 'products':
        return mockQueryResult({ data: products, error: null });
      case 'menu_planned_ingredients': {
        const builder = mockQueryResult({ data: [], error: null });
        builder.insert = vi.fn((rows: any[]) => { plannedInserted = rows; return builder; });
        return builder;
      }
      default:
        throw new Error(`unexpected table ${table}`);
    }
  });
});

describe('calculateMenuCost', () => {

  it('prices at the Dar es Salaam branch by default', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);

    expect(res.branch).toBe('Dar es Salaam');
    // rice 2 kg x 3000 + oil 1 l x 5000 + salt 0.5 kg x 2000
    expect(res.totalCost).toBe(12000);
    expect(res.missingPrices).toEqual(['Eggs (unit)', 'Mystery spice']);

    const byName = Object.fromEntries(res.ingredientsSummary.map(i => [i.ingredient, i]));
    expect(byName['Rice']).toMatchObject({ totalQuantity: 2, unit: 'kg', unitCost: 3000, totalCost: 6000 });
    expect(byName['Salt']).toMatchObject({ totalQuantity: 0.5, unit: 'kg', unitCost: 2000, totalCost: 1000 });
    expect(byName['Cooking oil']).toMatchObject({ unitCost: 5000, totalCost: 5000 });
  });

  it('never adds a zero-cost line', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    for (const branch of ['Dar es Salaam', 'Arusha', 'Dodoma'] as const) {
      const res = await calculateMenuCost('M1', 10, false, branch);
      for (const line of res.ingredientsSummary) {
        expect(line.unitCost).toBeGreaterThan(0);
      }
    }
  });

  it('reports a product priced 0 at Arusha as missing, and gives a different total', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const dar = await calculateMenuCost('M1', 10, false, 'Dar es Salaam');
    const arusha = await calculateMenuCost('M1', 10, false, 'Arusha');

    expect(arusha.branch).toBe('Arusha');
    // rice 2 x 3500 + salt 0.5 x 2000; oil has no Arusha price
    expect(arusha.totalCost).toBe(8000);
    expect(arusha.missingPrices).toEqual(['Cooking oil', 'Eggs (unit)', 'Mystery spice']);
    expect(arusha.ingredientsSummary.map(i => i.ingredient)).not.toContain('Cooking oil');
    expect(arusha.totalCost).not.toBe(dar.totalCost);
  });

  it('lists lines with no product: legacy ingredient-only lines and deleted products', async () => {
    recipe.ingredients.push({ ingredientId: 'ING-OLD', quantity: 1, unit: 'kg' });
    recipe.ingredients.push({ productId: 'P-GONE', quantity: 1, unit: 'kg' });
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    expect(res.missingPrices).toContain('ING-OLD (no product)');
    expect(res.missingPrices).toContain('P-GONE (product not found)');
    expect(res.totalCost).toBe(12000);
  });

  it('costs pieces against a kg-priced product once the product has grams_per_item', async () => {
    products = products.map(p => (p.id === 'P-EGG' ? { ...p, grams_per_item: 60 } : p));
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    // 6 eggs x 60 g = 0.36 kg x 8000 = 2880
    expect(res.missingPrices).toEqual(['Mystery spice']);
    expect(res.totalCost).toBe(12000 + 2880);
  });

  it('aggregates the same product used in several recipes into one line', async () => {
    recipesRows = [recipe, { recipeNumber: 'RN-2', recipeName: 'Rice side', ingredients: [{ productId: 'P-RICE', quantity: 1, unit: 'kg' }] }];
    menuRecipes = [...menuRecipes, { id: 'MR2', menu_id: 'M1', recipe_number: 'RN-2', recipes: { recipeName: 'Rice side' } }];
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    const rice = res.ingredientsSummary.filter(i => i.ingredient === 'Rice');
    expect(rice).toHaveLength(1);
    expect(rice[0]).toMatchObject({ totalQuantity: 3, totalCost: 9000 });
  });

  it('falls back to products.unit when base_unit is not set (per-gram pricing stays per gram)', async () => {
    products = products.map(p => (p.id === 'P-SALT' ? { ...p, unit: 'gms', base_unit: null, unitPrice_dar: 2 } : p));
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    const salt = res.ingredientsSummary.find(i => i.ingredient === 'Salt');
    // 500 gms x 2 per gram = 1000, same as 0.5 kg x 2000
    expect(salt).toMatchObject({ totalQuantity: 500, unit: 'gms', unitCost: 2, totalCost: 1000 });
  });

  it('flags recipes with no ingredients and recipes it cannot read, instead of a silent zero', async () => {
    menuRecipes = [
      { id: 'MR1', menu_id: 'M1', recipe_number: 'RN-EMPTY', recipes: { recipeName: 'Vegetable', recipeType: 'Lunch' } },
      { id: 'MR2', menu_id: 'M1', recipe_number: 'RN-HIDDEN', recipes: null },
    ];
    // RN-HIDDEN is not returned (e.g. owned by another user under RLS).
    recipesRows = [{ recipeNumber: 'RN-EMPTY', recipeName: 'Vegetable', ingredients: [] }];
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    expect(res.totalCost).toBe(0);
    expect(res.missingPrices).toEqual(['RN-HIDDEN (recipe not found)', 'Vegetable (no ingredients)']);
  });

  it('keeps the wastage factor as before', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, true);
    expect(res.totalCost).toBe(13200); // 12000 x 1.1
    expect(res.revenue).toBe(100000);
  });
});

describe('syncPlannedIngredientsFromRecipes', () => {
  it('writes one planned row per product, named and priced from the catalog (Dar price)', async () => {
    const { syncPlannedIngredientsFromRecipes } = await import('../menuCostingService');
    const ok = await syncPlannedIngredientsFromRecipes('M1');
    expect(ok).toBe(true);
    const byName = Object.fromEntries((plannedInserted ?? []).map(r => [r.ingredient_name, r]));
    expect(byName['Rice']).toMatchObject({ planned_quantity: 2, unit: 'kg', unit_cost: 3000 });
    expect(byName['Salt']).toMatchObject({ planned_quantity: 0.5, unit: 'kg', unit_cost: 2000 });
    // Unit cannot be converted: kept as entered, cost left for the user.
    expect(byName['Eggs']).toMatchObject({ planned_quantity: 6, unit: 'item', unit_cost: 0 });
  });
});

// Dated costing (data-readiness Phase 3, Step 6). The mocked prices_on applies
// the same rule as the SQL function: per product, the latest row at the branch
// with valid_from <= p_date.
describe('calculateMenuCost with a price date', () => {
  const history = [
    { product_id: 'P-RICE', branch: 'Dar es Salaam', unit: 'kg', unit_price: 2500, valid_from: '2026-03-01' },
    { product_id: 'P-RICE', branch: 'Dar es Salaam', unit: 'kg', unit_price: 9999, valid_from: '2026-09-01' }, // after the date
    { product_id: 'P-OIL', branch: 'Dar es Salaam', unit: 'liters', unit_price: 4000, valid_from: '2026-05-10' },
    { product_id: 'P-SALT', branch: 'Dar es Salaam', unit: 'kg', unit_price: 1500, valid_from: '2026-07-01' }, // after the date
  ];

  beforeEach(() => {
    rpcMock.mockImplementation((fn: string, args: { p_branch: string; p_date: string }) => {
      expect(fn).toBe('prices_on');
      const latest = new Map<string, any>();
      for (const row of history) {
        if (row.branch !== args.p_branch || row.valid_from > args.p_date) continue;
        const prev = latest.get(row.product_id);
        if (!prev || row.valid_from > prev.valid_from) latest.set(row.product_id, row);
      }
      return Promise.resolve({ data: Array.from(latest.values()), error: null });
    });
  });

  it('uses the latest price on or before the date, not the catalog price', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false, 'Dar es Salaam', '2026-06-15');

    expect(rpcMock).toHaveBeenCalledWith('prices_on', { p_branch: 'Dar es Salaam', p_date: '2026-06-15' });
    expect(res.priceDate).toBe('2026-06-15');
    const byName = Object.fromEntries(res.ingredientsSummary.map(i => [i.ingredient, i]));
    expect(byName['Rice']).toMatchObject({ unitCost: 2500, totalCost: 5000 });
    expect(byName['Cooking oil']).toMatchObject({ unitCost: 4000, totalCost: 4000 });
  });

  it('ignores a price dated after the date', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false, 'Dar es Salaam', '2026-06-15');
    const rice = res.ingredientsSummary.find(i => i.ingredient === 'Rice');
    expect(rice?.unitCost).not.toBe(9999);
    expect(res.ingredientsSummary.map(i => i.ingredient)).not.toContain('Salt');
  });

  it('sends a product with no price on that date to missingPrices', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false, 'Dar es Salaam', '2026-06-15');
    // Salt is only priced from July; spice never; eggs cannot be converted.
    expect(res.missingPrices).toEqual(['Eggs', 'Mystery spice', 'Salt']);
    // rice 2 kg x 2500 + oil 1 l x 4000
    expect(res.totalCost).toBe(9000);
  });

  it('keeps the catalog prices when no date is given', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(res.priceDate).toBeUndefined();
    expect(res.totalCost).toBe(12000);
  });
});
