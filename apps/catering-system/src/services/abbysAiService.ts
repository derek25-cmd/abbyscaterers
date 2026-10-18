import { supabase } from '@/lib/supabase-client';
import type { DishCost, MenuIdea, QuoteCheckResult } from '@/lib/abbys-ai';

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
