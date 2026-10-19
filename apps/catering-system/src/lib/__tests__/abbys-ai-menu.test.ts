import { describe, it, expect } from 'vitest';
import {
  applicableRules, buildMenu, dishKey, foodType, foodTypeCount, mealSections, sectionSize, topUpPool, type MenuRule,
} from '../abbys-ai-menu';
import type { MenuIdea } from '../abbys-ai';

// The company rules (seeded by 20261019090000_abbys_ai_menu_rules.sql).
const rule = (section: string, label: string, recipe_number: string, recipe_name: string, match_pattern: string, min: number | null = null): MenuRule =>
  ({ section, label, recipe_number, recipe_name, match_pattern, min_price_exclusive: min, active: true });
const RULES: MenuRule[] = [
  ...['Lunch', 'Dinner'].flatMap(s => [
    rule(s, 'Salad', 'RN-00344', 'salad', '^(?!.*fruit).*\\bsalad\\b'),
    rule(s, 'Fruits', 'RN-00266', 'Fruits cuts', '\\bfruits?\\b|\\bpa(pai|paya)\\b|\\bwatermelon\\b'),
    rule(s, 'Peri-peri sauce', 'RN-00229', ' Peri-peri sauce', '\\bperi[- ]?peri\\b|\\bpiri[- ]?piri\\b'),
    rule(s, 'Mineral drinking water', 'RN-00227', ' Mineral drinking water (500ml)', '\\bmineral\\b.*\\bwater\\b', 10000),
  ]),
  rule('Breakfast', 'Tea masala', 'RN-00175', 'Tea Masala', '^(black )?tea masala$'),
];

const idea = (section: string, dish_key: string, score: number, recipe_id: string | null = null): MenuIdea =>
  ({ section, dish_key, recipe_id, recipe_name: dish_key, events: 10, share: score, band_share: null, score });

// A lunch pool of 80 dishes: the usual core, then many mains, starches, vegetables...
const LUNCH_POOL: MenuIdea[] = [
  idea('Lunch', 'mixed salad', 0.9, 'RN-00291'), idea('Lunch', 'fruits cuts', 0.8, 'RN-00266'),
  idea('Lunch', 'juice (fresh)', 0.7), idea('Lunch', 'vegetable', 0.66), idea('Lunch', 'beans', 0.4),
  idea('Lunch', 'banana stew', 0.35), idea('Lunch', 'ugali', 0.3), idea('Lunch', 'vegetable rice', 0.28),
  idea('Lunch', 'fruits', 0.25), idea('Lunch', 'salad of the day', 0.2),
  ...Array.from({ length: 20 }, (_, i) => idea('Lunch', `beef dish ${i}`, 0.2 - i * 0.005)),
  ...Array.from({ length: 15 }, (_, i) => idea('Lunch', `chicken dish ${i}`, 0.19 - i * 0.005)),
  ...Array.from({ length: 10 }, (_, i) => idea('Lunch', `fish dish ${i}`, 0.15 - i * 0.005)),
  ...Array.from({ length: 15 }, (_, i) => idea('Lunch', `rice dish ${i}`, 0.18 - i * 0.005)),
  ...Array.from({ length: 10 }, (_, i) => idea('Lunch', `peas dish ${i}`, 0.12 - i * 0.005)),
];
const BREAKFAST_POOL: MenuIdea[] = [
  idea('Breakfast', 'black & milk tea', 0.5), idea('Breakfast', 'boiled eggs', 0.6), idea('Breakfast', 'vegetable', 0.6),
  idea('Breakfast', 'fruits cuts', 0.5), idea('Breakfast', 'bread rolls', 0.34), idea('Breakfast', 'mandazi', 0.3),
  idea('Breakfast', 'milk tea masala', 0.07), idea('Breakfast', 'sausage', 0.25), idea('Breakfast', 'chapati', 0.2),
  idea('Breakfast', 'uji', 0.1), idea('Breakfast', 'boiled cassava', 0.12),
];
const pools = { Lunch: LUNCH_POOL, Dinner: LUNCH_POOL.map(p => ({ ...p, section: 'Dinner' })), Breakfast: BREAKFAST_POOL };
const band = (p: number) => p < 6000 ? 'A <6k' : p < 11000 ? 'B 6-11k' : p < 15000 ? 'C 11-15k' : p < 22000 ? 'D 15-22k' : p < 30000 ? 'E 22-30k' : 'F 30k+';
const make = (meal: string, price: number, option = 0) =>
  buildMenu({ sections: mealSections(meal), pools, rules: RULES, price, band: band(price), option });
const keys = (meal: string, price: number, section: string, option = 0) =>
  make(meal, price, option).sections.find(s => s.section === section)!.dishes.map(d => d.dish_key);

describe('company menu rules', () => {
  it('every lunch and dinner has a salad, fruits and peri-peri sauce', () => {
    for (const meal of ['Lunch only', 'Dinner only']) {
      for (const price of [4000, 12000, 35000]) {
        const s = make(meal, price).sections[0];
        const labels = s.dishes.filter(d => d.reason.kind === 'rule').map(d => (d.reason as { label: string }).label);
        expect(labels).toEqual(expect.arrayContaining(['Salad', 'Fruits', 'Peri-peri sauce']));
      }
    }
  });

  it('a rule is met by any dish of its kind, without a second one', () => {
    const lunch = keys('Lunch only', 12000, 'Lunch');
    expect(lunch).toContain('mixed salad');      // the best-scored salad meets the rule
    expect(lunch).not.toContain('salad');        // so the default recipe is not added
    expect(lunch).not.toContain('salad of the day');
    expect(lunch.filter(k => /fruit/.test(k))).toEqual(['fruits cuts']);
  });

  it('adds the rule recipe when no dish of its kind was served', () => {
    const s = make('Lunch only', 12000).sections[0];
    const peri = s.dishes.find(d => d.reason.kind === 'rule' && d.reason.label === 'Peri-peri sauce')!;
    expect(peri).toMatchObject({ dish_key: 'peri-peri sauce', recipe_id: 'RN-00229', recipe_name: 'Peri-peri sauce' });
  });

  it('mineral water only above TZS 10,000, for lunch and dinner', () => {
    expect(keys('Lunch only', 10000, 'Lunch')).not.toContain('mineral drinking water (500ml)');
    expect(keys('Lunch only', 10001, 'Lunch')).toContain('mineral drinking water (500ml)');
    expect(keys('Dinner only', 25000, 'Dinner')).toContain('mineral drinking water (500ml)');
    expect(keys('Breakfast only', 25000, 'Breakfast')).not.toContain('mineral drinking water (500ml)');
    expect(applicableRules(RULES, 'Lunch', null).map(r => r.label)).not.toContain('Mineral drinking water');
  });

  it('every breakfast has tea masala (milk tea masala does not count)', () => {
    for (const price of [4800, 8000, 30000]) {
      const b = keys('Breakfast only', price, 'Breakfast');
      expect(b).toContain('tea masala');
    }
    expect(keys('Breakfast and lunch', 25000, 'Breakfast')).toContain('tea masala');
  });

  it('keeps the rules on every alternative option', () => {
    for (let option = 1; option <= 20; option++) {
      const l = keys('Lunch only', 15000, 'Lunch', option);
      expect(l.some(k => /salad/.test(k))).toBe(true);
      expect(l.some(k => /fruit/.test(k))).toBe(true);
      expect(l).toContain('peri-peri sauce');
      expect(l).toContain('mineral drinking water (500ml)');
    }
  });
});

describe('variety grows with the price', () => {
  it('more dishes per section at a higher price', () => {
    const sizes = [4000, 8000, 12000, 18000, 25000, 35000].map(p => make('Lunch only', p).sections[0].dishes.length);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    expect(sizes[0]).toBe(sectionSize('Lunch', 'A <6k'));
    expect(sizes[5]).toBe(sectionSize('Lunch', 'F 30k+'));
  });

  it('more food types at a higher price', () => {
    const cheap = foodTypeCount(make('Lunch only', 5000).sections[0].dishes);
    const dear = foodTypeCount(make('Lunch only', 35000).sections[0].dishes);
    expect(dear).toBeGreaterThan(cheap);
  });

  it('alternatives rotate through the wider pool (more than 70 dishes)', () => {
    const seen = new Set<string>();
    for (let option = 0; option < 30; option++) keys('Lunch only', 25000, 'Lunch', option).forEach(k => seen.add(k));
    expect(LUNCH_POOL.length).toBeGreaterThan(70);
    expect(seen.size).toBeGreaterThan(40);
    expect(keys('Lunch only', 25000, 'Lunch', 1)).not.toEqual(keys('Lunch only', 25000, 'Lunch', 2));
    expect(keys('Lunch only', 25000, 'Lunch', 3)).toEqual(keys('Lunch only', 25000, 'Lunch', 3)); // reproducible
  });
});

describe('helpers', () => {
  it('reads meal sections from the meal type', () => {
    expect(mealSections('Breakfast, lunch and evening tea')).toEqual(['Breakfast', 'Lunch', 'Evening Tea']);
    expect(mealSections('Dinner only')).toEqual(['Dinner']);
  });
  it('normalises names like the database', () => {
    expect(dishKey('  Mineral drinking water ( 500ml ) ')).toBe('mineral drinking water (500ml)');
  });
  it('classifies food types', () => {
    expect(foodType('fruits salad (youghout)')).toBe('fruit');
    expect(foodType('mango salad')).toBe('salad');
    expect(foodType('banana stew')).toBe('starch');
    expect(foodType('beef pilau')).toBe('meat');
    expect(foodType('peri-peri sauce')).toBe('sauce');
    expect(foodType('tea masala')).toBe('drink');
    expect(foodType('mandazi')).toBe('snack');
  });
  it('tops up a small pool, ranked after its own dishes', () => {
    const own = [idea('Dinner', 'beef roast', 0.5)];
    const out = topUpPool(own, [idea('Lunch', 'beef roast', 0.9), idea('Lunch', 'ugali', 0.8)], 'Dinner', 70);
    expect(out.map(o => o.dish_key)).toEqual(['beef roast', 'ugali']);
    expect(out[1]).toMatchObject({ section: 'Dinner', score: 0.8 * 0.6 });
  });
});
