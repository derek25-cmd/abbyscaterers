import { supabase } from '@/lib/supabase-client';
import type { DishCost, MenuIdea, QuoteCheckResult } from '@/lib/abbys-ai';
import { MIN_POOL, mealSections, topUpPool, type MenuRule } from '@/lib/abbys-ai-menu';

// Abby's AI (beta). The quote check and menu ideas are database functions
// reading live orders and menus; dish costs come from the published model
// run (scripts/db/publish-ai-model.sh).

export const checkQuote = async (clientId: string, mealType: string, price: number | null): Promise<QuoteCheckResult> => {
  const { data, error } = await supabase.rpc('abby_ai_quote_check', {
    p_client_id: clientId,
    p_meal_type: mealType,
    p_price: price,
  });
  if (error) throw new Error(error.message);
  return data as QuoteCheckResult;
};

export const getMenuIdeas = async (mealType: string, price: number | null, limit = 8): Promise<MenuIdea[]> => {
  const { data, error } = await supabase.rpc('abby_ai_menu_ideas', {
    p_meal_type: mealType,
    p_price: price,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data || []) as MenuIdea[]).map(r => ({
    ...r,
    share: Number(r.share),
    band_share: r.band_share === null ? null : Number(r.band_share),
    score: Number(r.score),
  }));
};

/** The company's menu rules (ai_menu_rules), with each rule's default recipe name. */
export const getMenuRules = async (): Promise<MenuRule[]> => {
  const { data, error } = await supabase
    .from('ai_menu_rules')
    .select('section, label, recipe_number, match_pattern, min_price_exclusive, active, recipes(recipeName)')
    .eq('active', true);
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    section: r.section,
    label: r.label,
    recipe_number: r.recipe_number,
    recipe_name: String((Array.isArray(r.recipes) ? r.recipes[0]?.recipeName : r.recipes?.recipeName) ?? r.label).trim(),
    match_pattern: r.match_pattern,
    min_price_exclusive: r.min_price_exclusive === null ? null : Number(r.min_price_exclusive),
    active: r.active,
  }));
};

/**
 * The dish pool per meal section (up to 150 dishes each). A section with
 * fewer than MIN_POOL dishes (Dinner) is topped up with Lunch dishes.
 */
export const getMenuPools = async (mealType: string, price: number | null): Promise<Record<string, MenuIdea[]>> => {
  const rows = await getMenuIdeas(mealType, price, 150);
  const pools: Record<string, MenuIdea[]> = {};
  for (const s of mealSections(mealType)) pools[s] = rows.filter(r => r.section === s);
  if (pools.Dinner && pools.Dinner.length < MIN_POOL) {
    const lunch = pools.Lunch ?? (await getMenuIdeas('Lunch', price, 150)).filter(r => r.section === 'Lunch');
    pools.Dinner = topUpPool(pools.Dinner, lunch, 'Dinner', MIN_POOL);
  }
  return pools;
};

/** Published dish costs; empty for roles that may not see costs (RLS). */
export const getDishCosts = async (): Promise<DishCost[]> => {
  const { data, error } = await supabase.from('ai_dish_costs').select('dish_key, meal_section, cost_per_plate, model_run');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ...r, cost_per_plate: Number(r.cost_per_plate) })) as DishCost[];
};

export const getCurrentModelRun = async (): Promise<{ run: string; published_at: string } | null> => {
  const { data, error } = await supabase
    .from('ai_model_runs')
    .select('run, published_at')
    .order('published_at', { ascending: false })
    .limit(1);
  if (error) return null;
  return (data && data[0]) || null;
};

export const sendAiFeedback = async (feedback: {
  tool: 'quote' | 'menu' | 'cost';
  rating: 1 | -1;
  comment?: string;
  input: unknown;
  output: unknown;
  modelRun?: string | null;
}): Promise<boolean> => {
  const { error } = await supabase.from('ai_feedback').insert({
    tool: feedback.tool,
    rating: feedback.rating,
    comment: feedback.comment?.trim() || null,
    input: feedback.input ?? null,
    output: feedback.output ?? null,
    model_run: feedback.modelRun ?? null,
  });
  if (error) {
    console.error('Could not save AI feedback:', error.message);
    return false;
  }
  return true;
};
