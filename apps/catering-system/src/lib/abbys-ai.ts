// Abby's AI (beta): pure helpers for the quote check, menu ideas and cost
// estimate. The models run in the database (abby_ai_quote_check,
// abby_ai_menu_ideas) or are published from ml/ (ai_dish_costs).

export const VAT_RATE = 0.18;

export type QuoteSource = 'client_same_meal' | 'client_other_meals' | 'market';
export type QuoteVerdict = 'low' | 'ok' | 'high';

export interface QuoteCheckResult {
  meal: string;
  expected_price: number | null;
  expected_band: string | null;
  expected_from: QuoteSource;
  market_median: number | null;
  same_meal: {
    events: number;
    last_price: number;
    last_date: string;
    median_price: number;
    min_price: number;
    max_price: number;
  } | null;
  client_events: number;
  recent: { event_id: string; order_id: string; event_date: string; meal_type: string | null; pax: number; unit_price: number }[];
  price: number | null;
  price_band: string | null;
  diff_pct: number | null;
  verdict: QuoteVerdict | null;
}

export interface MenuIdea {
  section: string;
  dish_key: string;
  recipe_id: string | null;
  recipe_name: string | null;
  events: number;
  share: number;
  band_share: number | null;
  score: number;
}

export interface DishCost {
  dish_key: string;
  meal_section: string | null;
  cost_per_plate: number;
  model_run: string;
}

export function sourceLabel(source: QuoteSource, meal: string): string {
  switch (source) {
    case 'client_same_meal':
      return `this client's last price for ${meal}`;
    case 'client_other_meals':
      return `this client's usual level on other meals, applied to the ${meal} market price`;
    default:
      return `the market price for ${meal} (no history for this client)`;
  }
}

export function verdictText(r: QuoteCheckResult): { tone: 'warn' | 'ok' | 'info'; title: string; detail: string } {
  if (r.verdict === null || r.diff_pct === null || r.expected_price === null) {
    return { tone: 'info', title: 'Enter a price to check it', detail: '' };
  }
  const pct = Math.round(Math.abs(r.diff_pct) * 100);
  const based = r.expected_from === 'market' ? ' New client: this compares with the market, not their own history.' : '';
  if (r.verdict === 'low') {
    return { tone: 'warn', title: `${pct}% below expected`, detail: `Check before sending: discount on purpose, or a typing error?${based}` };
  }
  if (r.verdict === 'high') {
    return { tone: 'info', title: `${pct}% above expected`, detail: `Higher than usual; fine if the menu or service is bigger.${based}` };
  }
  return { tone: 'ok', title: 'In line with expected', detail: `Within 10% of the expected price.${based}` };
}

/** Cost of one dish per plate; a dish the model has no own cost for uses its section's pooled cost. */
export function dishCostPerPlate(dish: string, section: string | null, costs: Map<string, DishCost>): { cost: number | null; pooled: boolean } {
  const own = costs.get(dish.trim().toLowerCase());
  if (own) return { cost: Number(own.cost_per_plate), pooled: false };
  const pooled = section ? costs.get(`other ${section.toLowerCase()} dish`) : undefined;
  return pooled ? { cost: Number(pooled.cost_per_plate), pooled: true } : { cost: null, pooled: false };
}

export interface CostEstimate {
  lines: { dish: string; section: string | null; cost: number | null; pooled: boolean }[];
  costPerPlate: number;
  unknownDishes: string[];
  priceExVat: number | null;
  foodCostPct: number | null;
  marginPerPlate: number | null;
  totalCost: number | null;
  totalMargin: number | null;
}

/**
 * Estimated ingredient cost of a menu. `price` is the price per plate as
 * quoted; `vatInclusive` (the usual case) takes VAT out before the margin.
 */
export function estimateMenuCost(
  dishes: { dish: string; section: string | null }[],
  costs: Map<string, DishCost>,
  price: number | null,
  pax: number | null,
  vatInclusive = true,
): CostEstimate {
  const lines = dishes.map(d => ({ ...d, ...dishCostPerPlate(d.dish, d.section, costs) }));
  const costPerPlate = Math.round(lines.reduce((s, l) => s + (l.cost ?? 0), 0));
  const priceExVat = price && price > 0 ? Math.round(vatInclusive ? price / (1 + VAT_RATE) : price) : null;
  const marginPerPlate = priceExVat !== null ? priceExVat - costPerPlate : null;
  return {
    lines,
    costPerPlate,
    unknownDishes: lines.filter(l => l.cost === null).map(l => l.dish),
    priceExVat,
    foodCostPct: priceExVat ? Math.round((costPerPlate / priceExVat) * 1000) / 10 : null,
    marginPerPlate,
    totalCost: pax && pax > 0 ? costPerPlate * pax : null,
    totalMargin: pax && pax > 0 && marginPerPlate !== null ? marginPerPlate * pax : null,
  };
}

/** Roles that may see ingredient costs and margins (same as the ai_dish_costs RLS). */
export const COST_ROLES = ['admin', 'general_manager', 'finance'] as const;
