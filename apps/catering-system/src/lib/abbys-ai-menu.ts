// Abby's AI menu builder: turns the pool of dishes served before
// (abby_ai_menu_ideas) into a full menu that follows the company's rules.
//
//   * Required dishes (ai_menu_rules): e.g. salad, fruits and peri-peri sauce
//     at every lunch and dinner, water above TZS 10,000, tea masala at
//     breakfast. A rule is met by any dish of its kind; otherwise its recipe
//     is added.
//   * Size and variety grow with the price: more dishes per section, and each
//     added dish favours a food type the menu does not have yet.
//   * Variety between menus: option 0 is the most typical menu; "another
//     option" draws from the wider pool (more than 70 dishes where the
//     history has them) with weighted randomness, so menus rotate.

import type { MenuIdea } from './abbys-ai';

export type FoodType =
  | 'salad' | 'fruit' | 'drink' | 'sauce' | 'meat' | 'fish' | 'eggs' | 'legumes'
  | 'vegetables' | 'starch' | 'snack' | 'porridge' | 'dessert' | 'other';

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  salad: 'Salad', fruit: 'Fruit', drink: 'Drink', sauce: 'Sauce', meat: 'Meat', fish: 'Fish & seafood',
  eggs: 'Eggs', legumes: 'Beans & peas', vegetables: 'Vegetables', starch: 'Starch', snack: 'Snack & pastry',
  porridge: 'Soup & porridge', dessert: 'Dessert', other: 'Other',
};

// Order matters: the first match wins ("fruits salad" is fruit, "beef pilau"
// is meat, "vegetable rice" is starch, "biryani sauce + beef" is meat).
const FOOD_TYPE_RULES: [FoodType, RegExp][] = [
  ['fruit', /\bfruits?\b|\bpa(pai|paya|w ?paw)\b|watermelon|pineapple|\bmango(es)?\b(?!.*salad)|\bbanana(s)?\b(?!.*(stew|matoke))|avocado/],
  ['salad', /salad|coleslaw|caslaw|kachumbari|cucumber/],
  ['drink', /\bjuice\b|\bwater\b|\bh2o\b|\bsoda\b|\btea\b|coffee|\bmilk\b|\bchai\b|smoothie|cocoa|\bdrinks?\b|maziwa/],
  ['dessert', /dessert|ice ?cream|pudding|custard|yo(g|gh)(u|o)u?rt|cake(?!s? (fish|beef))/],
  ['porridge', /\buji\b|porridge|\bsoup\b/],
  ['fish', /fish|samaki|prawn|shrimp|tilapia|\bsato\b|dagaa|octopus|squid|calamari|tuna|seafood/],
  ['meat', /beef|chicken|\bkuku\b|goat|mbuzi|nyama|pork|\bmeat\b|mutton|lamb|liver|maini|sausage|mishkaki|steak|turkey|duck/],
  ['starch', /rice|pilau|pilaf|biriani|biryani|biryan|pasta|spaghetti|macaron|noodles|lasagna|couscous|tambi|pizza/],
  ['legumes', /beans?|\bpeas\b|maharag|dengu|lentil|njegere|chickpea|ndengu|kunde|mbaazi/],
  ['sauce', /sauce|peri[- ]?peri|piri[- ]?piri|chilli|chili|chachandu|salsa|\bdip\b|gravy/],
  ['eggs', /\beggs?\b|omel(e)?t+e?|mayai/],
  ['snack', /m?andazi|samosa|bagia|kachori|doughnut|donut|donati|pancake|cookie|biscuit|kalmat|toast|sandwich|croissant|muffin|scone|bites|rolls?\b|vitumbua|chapat+i|cupcake|bread|mkate|crepe|waffle/],
  ['vegetables', /vegetable|spinach|cabbage|greens|mboga|sukuma|carrot|broccoli|okra|bamia|eggplant|biringanya|pumpkin|pumpikn|cauliflower|\bveg\b|mchicha|m?a?tembele|kisamvu|ratatouille|\bboga\b|onions?/],
  ['starch', /ugali|potato|chips|viazi|kiazi|ndizi|matoke|plantain|mzuzu|banana|cas+ava|muhogo|yam|cocoyam|gimbi|makande|mtori|makange|maize|muhindi|mahindi/],
];

export function foodType(dish: string): FoodType {
  const d = dish.toLowerCase();
  for (const [type, re] of FOOD_TYPE_RULES) if (re.test(d)) return type;
  return 'other';
}

/** Same normalisation as the database's dish_key (lower case, spaces collapsed, none inside brackets). */
export function dishKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

// Dishes per section, by price band (the required dishes included). Menus in
// the history stay at ~9 lunch dishes whatever the price; the company rule is
// that a higher price brings more variety.
export const MENU_SIZE: Record<'main' | 'breakfast' | 'light', Record<string, number>> = {
  main:      { 'A <6k': 7, 'B 6-11k': 9, 'C 11-15k': 11, 'D 15-22k': 13, 'E 22-30k': 15, 'F 30k+': 17 },
  breakfast: { 'A <6k': 5, 'B 6-11k': 7, 'C 11-15k': 8, 'D 15-22k': 9, 'E 22-30k': 10, 'F 30k+': 11 },
  light:     { 'A <6k': 4, 'B 6-11k': 5, 'C 11-15k': 6, 'D 15-22k': 7, 'E 22-30k': 8, 'F 30k+': 9 },
};

export function sectionSize(section: string, band: string | null): number {
  const kind = section === 'Lunch' || section === 'Dinner' ? 'main' : section === 'Breakfast' ? 'breakfast' : 'light';
  return MENU_SIZE[kind][band ?? 'C 11-15k'] ?? MENU_SIZE[kind]['C 11-15k'];
}

export interface MenuRule {
  section: string;
  label: string;
  recipe_number: string;
  recipe_name: string;
  match_pattern: string;
  min_price_exclusive: number | null;
  active: boolean;
}

export interface MenuDish {
  section: string;
  dish_key: string;
  recipe_id: string | null;
  recipe_name: string | null;
  food_type: FoodType;
  /** Why it is on the menu: a company rule, or picked from the pool. */
  reason: { kind: 'rule'; label: string } | { kind: 'pool'; share: number };
}

export interface BuiltMenu {
  sections: { section: string; target: number; poolSize: number; dishes: MenuDish[] }[];
}

/** Rules that apply to a section at this price (water only above TZS 10,000). */
export function applicableRules(rules: MenuRule[], section: string, price: number | null): MenuRule[] {
  return rules.filter(r => r.active && r.section === section &&
    (r.min_price_exclusive === null || (price !== null && price > Number(r.min_price_exclusive))));
}

function ruleRegex(r: MenuRule): RegExp {
  try { return new RegExp(r.match_pattern, 'i'); } catch { return new RegExp(`^${dishKey(r.recipe_name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'); }
}

// Small deterministic PRNG so "option N" is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weight of a dish whose food type is already on the menu, per repeat.
export const TYPE_REPEAT_PENALTY = 0.35;

/**
 * Build one menu. `pools` maps section -> candidate dishes (best first).
 * option 0 = the most typical menu; option 1, 2, ... = rotated alternatives.
 */
export function buildMenu(params: {
  sections: string[];
  pools: Record<string, MenuIdea[]>;
  rules: MenuRule[];
  price: number | null;
  band: string | null;
  option?: number;
  sizeOverride?: Record<string, number>;
}): BuiltMenu {
  const { sections, pools, rules, price, band, option = 0, sizeOverride } = params;
  const rand = mulberry32(0x9e3779b9 ^ (option * 7919 + 1));
  const out: BuiltMenu['sections'] = [];

  for (const section of sections) {
    const pool = (pools[section] || []).filter(p => p.dish_key);
    const target = sizeOverride?.[section] ?? sectionSize(section, band);
    const chosen: MenuDish[] = [];
    const used = new Set<string>();
    const typeCount = new Map<FoodType, number>();
    const add = (d: MenuDish) => {
      chosen.push(d);
      used.add(d.dish_key);
      typeCount.set(d.food_type, (typeCount.get(d.food_type) || 0) + 1);
    };

    // 1. Required dishes: the best-scored dish of the kind, else the rule's recipe.
    const ruleRes = applicableRules(rules, section, price).map(r => ({ r, re: ruleRegex(r) }));
    for (const { r, re } of ruleRes) {
      const match = pool.find(p => !used.has(p.dish_key) && re.test(p.dish_key));
      const key = match ? match.dish_key : dishKey(r.recipe_name);
      if (used.has(key)) continue;
      add({
        section, dish_key: key,
        recipe_id: match ? match.recipe_id : r.recipe_number,
        recipe_name: match ? match.recipe_name : r.recipe_name.trim(),
        food_type: foodType(key),
        reason: { kind: 'rule', label: r.label },
      });
    }

    // 2. Fill up to the target: never a second dish of a required kind; each
    //    pick weighs popularity against food types already on the menu.
    const candidates = pool.filter(p => !used.has(p.dish_key) && !ruleRes.some(({ re }) => re.test(p.dish_key)));
    while (chosen.length < target) {
      const open = candidates.filter(c => !used.has(c.dish_key));
      if (open.length === 0) break;
      // Option 0 ranks by popularity; alternatives flatten it (score^0.6) so
      // less common dishes get a turn. Either way a food type already on the
      // menu weighs less each time it repeats.
      const weights = open.map(c => {
        const base = Math.pow(Math.max(c.score, 0.001), option === 0 ? 1 : 0.6);
        return base * Math.pow(TYPE_REPEAT_PENALTY, typeCount.get(foodType(c.dish_key)) || 0);
      });
      let idx: number;
      if (option === 0) {
        idx = weights.indexOf(Math.max(...weights));
      } else {
        const flat = weights;
        const total = flat.reduce((s, w) => s + w, 0);
        let x = rand() * total;
        idx = 0;
        while (idx < flat.length - 1 && x >= flat[idx]) { x -= flat[idx]; idx++; }
      }
      const c = open[idx];
      add({ section, dish_key: c.dish_key, recipe_id: c.recipe_id, recipe_name: c.recipe_name,
            food_type: foodType(c.dish_key), reason: { kind: 'pool', share: c.band_share ?? c.share } });
    }
    out.push({ section, target, poolSize: pool.length, dishes: chosen });
  }
  return { sections: out };
}

/** Distinct food types on a built section (a variety measure). */
export function foodTypeCount(dishes: MenuDish[]): number {
  return new Set(dishes.map(d => d.food_type)).size;
}

const SECTION_ORDER = ['Breakfast', 'Brunch', 'Lunch', 'Evening Tea', 'Dinner', 'Cocktail'] as const;

/** Meal sections of an event meal type, as the database reads it ("Breakfast and lunch" -> Breakfast, Lunch). */
export function mealSections(mealType: string): string[] {
  const m = mealType.toLowerCase();
  const has: Record<string, boolean> = {
    Breakfast: m.includes('breakfast'),
    Brunch: m.includes('brunch'),
    Lunch: m.includes('lunch'),
    'Evening Tea': m.includes('tea'),
    Dinner: /dinner|supper/.test(m),
    Cocktail: m.includes('cocktail'),
  };
  return SECTION_ORDER.filter(s => has[s]);
}

/** Merge a smaller pool with dishes from a related section (e.g. Dinner with Lunch), ranked after its own. */
export function topUpPool(own: MenuIdea[], extra: MenuIdea[], section: string, minSize: number, weight = 0.6): MenuIdea[] {
  if (own.length >= minSize) return own;
  const have = new Set(own.map(o => o.dish_key));
  const added = extra
    .filter(e => !have.has(e.dish_key))
    .map(e => ({ ...e, section, score: e.score * weight, band_share: e.band_share === null ? null : e.band_share * weight, share: e.share * weight }));
  return [...own, ...added];
}

/** Pool size the menu builder aims to draw from (company rule: more than 70 dishes). */
export const MIN_POOL = 70;
