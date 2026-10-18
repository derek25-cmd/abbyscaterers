import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from './test-utils';

// calculateMenuCost (data-readiness Phase 2, Step 5): prices each recipe
// ingredient through ingredients.product_id at the chosen branch's price,
// converts units with toPriceUnit, and never adds a zero-cost line; what it
// cannot price goes to missingPrices.

const fromMock = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) },
}));

const MENU = { id: 'M1', name: 'Test lunch', base_people: 10, price_per_person: 10000, menu_types: { name: 'lunch' } };

const RECIPE = {
  recipeNumber: 'RN-1',
  recipeName: 'Pilau plate',
  ingredients: [
    { ingredientId: 'I-RICE', quantity: 2, unit: 'kg' },      // priced kg ingredient
    { ingredientId: 'I-SPICE', quantity: 1, unit: 'kg' },     // no product
    { ingredientId: 'I-OIL', quantity: 1, unit: 'liters' },   // priced at Dar, 0 at Arusha
    { ingredientId: 'I-SALT', quantity: 500, unit: 'gms' },   // gms line, kg-priced product
    { ingredientId: 'I-EGG', quantity: 6, unit: 'item' },     // pieces vs kg, no grams_per_item
  ],
};

let ingredients: any[];
let products: any[];

const baseIngredients = () => [
  { itemNumber: 'I-RICE', itemDescription: 'Rice', product_id: 'P-RICE', grams_per_item: null },
  { itemNumber: 'I-SPICE', itemDescription: 'Mystery spice', product_id: null, grams_per_item: null },
  { itemNumber: 'I-OIL', itemDescription: 'Cooking oil', product_id: 'P-OIL', grams_per_item: null },
  { itemNumber: 'I-SALT', itemDescription: 'Salt', product_id: 'P-SALT', grams_per_item: null },
  { itemNumber: 'I-EGG', itemDescription: 'Eggs', product_id: 'P-EGG', grams_per_item: null },
];

const baseProducts = () => [
  { id: 'P-RICE', name: 'Rice', unit: 'kg', base_unit: 'kg', unitPrice_dar: 3000, unitPrice_arusha: 3500, unitPrice_dodoma: 0 },
  { id: 'P-OIL', name: 'Cooking oil', unit: 'liters', base_unit: 'liters', unitPrice_dar: 5000, unitPrice_arusha: 0, unitPrice_dodoma: 0 },
  { id: 'P-SALT', name: 'Salt', unit: 'kg', base_unit: 'kg', unitPrice_dar: 2000, unitPrice_arusha: 2000, unitPrice_dodoma: 0 },
  { id: 'P-EGG', name: 'Eggs', unit: 'kg', base_unit: 'kg', unitPrice_dar: 8000, unitPrice_arusha: 8000, unitPrice_dodoma: 0 },
];

describe('calculateMenuCost', () => {
  beforeEach(() => {
    fromMock.mockReset();
    ingredients = baseIngredients();
    products = baseProducts();
    fromMock.mockImplementation((table: string) => {
      switch (table) {
        case 'catering_menus':
          return mockQueryResult({ data: MENU, error: null });
        case 'catering_menu_recipes':
          return mockQueryResult({
            data: [{ id: 'MR1', menu_id: 'M1', recipe_number: 'RN-1', recipes: { recipeName: 'Pilau plate', recipeType: 'Lunch' } }],
            error: null,
          });
        case 'recipes':
          return mockQueryResult({ data: [RECIPE], error: null });
        case 'ingredients':
          return mockQueryResult({ data: ingredients, error: null });
        case 'products':
          return mockQueryResult({ data: products, error: null });
        case 'menu_planned_ingredients':
          return mockQueryResult({ data: [], error: null });
        default:
          throw new Error(`unexpected table ${table}`);
      }
    });
  });

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

  it('lists an ingredient with no product, and one missing from the ingredients table', async () => {
    ingredients = ingredients.filter(i => i.itemNumber !== 'I-SPICE');
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    // Not in the table at all: reported under its id.
    expect(res.missingPrices).toContain('I-SPICE');
    expect(res.totalCost).toBe(12000);
  });

  it('costs pieces against a kg-priced product once grams_per_item is known', async () => {
    ingredients = ingredients.map(i => (i.itemNumber === 'I-EGG' ? { ...i, grams_per_item: 60 } : i));
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    // 6 eggs x 60 g = 0.36 kg x 8000 = 2880
    expect(res.missingPrices).toEqual(['Mystery spice']);
    expect(res.totalCost).toBe(12000 + 2880);
  });

  it('falls back to products.unit when base_unit is not set (per-gram pricing stays per gram)', async () => {
    products = products.map(p => (p.id === 'P-SALT' ? { ...p, unit: 'gms', base_unit: null, unitPrice_dar: 2 } : p));
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, false);
    const salt = res.ingredientsSummary.find(i => i.ingredient === 'Salt');
    // 500 gms x 2 per gram = 1000, same as 0.5 kg x 2000
    expect(salt).toMatchObject({ totalQuantity: 500, unit: 'gms', unitCost: 2, totalCost: 1000 });
  });

  it('keeps the wastage factor as before', async () => {
    const { calculateMenuCost } = await import('../menuCostingService');
    const res = await calculateMenuCost('M1', 10, true);
    expect(res.totalCost).toBe(13200); // 12000 x 1.1
    expect(res.revenue).toBe(100000);
  });
});
