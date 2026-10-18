
import { supabase } from '@/lib/supabase-client';
import { DailyMenu } from '@/types';

type MenuToSave = Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'>;
type Dish = DailyMenu['recipes'][number];

/**
 * A dish must be a recipe (data-readiness Phase 3, Step 8). A dish without a
 * recipeId is only accepted when the same unlinked dish (same name and note)
 * is already stored for that event and date, i.e. an old free-text entry
 * saved again unchanged. Editing one, or adding a new dish, needs a recipe.
 */
export class UnlinkedDishError extends Error {
    constructor(public readonly dishes: { event_id: string; menu_date: string; name: string }[]) {
        super(`${dishes.length} dish(es) have no recipe: pick a recipe for ${dishes.map(d => `"${d.name}"`).join(', ')}.`);
        this.name = 'UnlinkedDishError';
    }
}

const hasRecipe = (d: Dish) => typeof d.recipeId === 'string' && d.recipeId.trim() !== '';
const unlinkedKey = (d: Dish) => `${String(d.name || '').trim().toLowerCase()}|${String(d.note || '').trim()}`;

/** Dishes in `menus` that have no recipe and are not an unchanged copy of a stored unlinked dish. */
export function findNewUnlinkedDishes(menus: MenuToSave[], stored: Pick<DailyMenu, 'event_id' | 'menu_date' | 'recipes'>[]) {
    const available = new Map<string, Map<string, number>>();
    for (const s of stored) {
        const counts = available.get(`${s.event_id}|${s.menu_date}`) || new Map<string, number>();
        for (const d of Array.isArray(s.recipes) ? s.recipes : []) {
            if (d && !hasRecipe(d)) counts.set(unlinkedKey(d), (counts.get(unlinkedKey(d)) || 0) + 1);
        }
        available.set(`${s.event_id}|${s.menu_date}`, counts);
    }
    const bad: { event_id: string; menu_date: string; name: string }[] = [];
    for (const m of menus) {
        const counts = available.get(`${m.event_id}|${m.menu_date}`) || new Map<string, number>();
        for (const d of m.recipes || []) {
            if (hasRecipe(d)) continue;
            const left = counts.get(unlinkedKey(d)) || 0;
            if (left > 0) counts.set(unlinkedKey(d), left - 1);
            else bad.push({ event_id: m.event_id, menu_date: m.menu_date, name: d.name });
        }
    }
    return bad;
}

async function assertDishesLinked(menus: MenuToSave[]): Promise<void> {
    const needCheck = menus.filter(m => (m.recipes || []).some(d => !hasRecipe(d)));
    if (needCheck.length === 0) return;
    const eventIds = Array.from(new Set(needCheck.map(m => m.event_id)));
    const { data, error } = await supabase
        .from('daily_menus')
        .select('event_id, menu_date, recipes')
        .in('event_id', eventIds);
    if (error) throw new Error(`Could not check the stored menus: ${error.message}`);
    const bad = findNewUnlinkedDishes(needCheck, (data || []) as Pick<DailyMenu, 'event_id' | 'menu_date' | 'recipes'>[]);
    if (bad.length > 0) throw new UnlinkedDishError(bad);
}

export const getMenusByDate = async (date: string): Promise<DailyMenu[]> => {
    const { data, error } = await supabase
        .from('daily_menus')
        .select('*')
        .eq('menu_date', date);

    if (error) {
        console.error('Error fetching daily menus:', error);
        return [];
    }
    return data as DailyMenu[];
};

/** Throws UnlinkedDishError if a new or edited dish has no recipe. */
export const upsertDailyMenu = async (menuData: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'>): Promise<DailyMenu | null> => {
    await assertDishesLinked([menuData]);
    try {
        const { order_id, event_id, menu_date, recipes, region } = menuData;
        
        const { data, error } = await supabase
            .from('daily_menus')
            .upsert(
                { 
                    order_id,
                    event_id, 
                    menu_date, 
                    recipes, 
                    region, 
                    updated_at: new Date().toISOString() 
                },
                { onConflict: 'event_id, menu_date' }
            )
            .select()
            .single();
        
        if (error) {
            console.error('Error upserting daily menu:', JSON.stringify(error, null, 2));
            return null;
        }
        return data as DailyMenu;
    } catch (err) {
        console.error('Unexpected error upserting daily menu:', err);
        return null;
    }
}

/** Throws UnlinkedDishError if a new or edited dish has no recipe. */
export const bulkUpsertDailyMenus = async (menus: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'>[]): Promise<boolean> => {
    if (menus.length === 0) return true;
    await assertDishesLinked(menus);

    try {
        const uniqueMenus = new Map();
        const now = new Date().toISOString();

        menus.forEach(m => {
            const key = `${m.event_id}-${m.menu_date}`;
            uniqueMenus.set(key, {
                order_id: m.order_id,
                event_id: m.event_id,
                menu_date: m.menu_date,
                recipes: m.recipes,
                region: m.region,
                updated_at: now
            });
        });

        const payload = Array.from(uniqueMenus.values());

        const { error } = await supabase
            .from('daily_menus')
            .upsert(payload, { onConflict: 'event_id, menu_date' });

        if (error) {
            console.error('Error bulk upserting daily menus:', JSON.stringify(error, null, 2));
            return false;
        }
        return true;
    } catch (err) {
        console.error('Unexpected error bulk upserting daily menus:', err);
        return false;
    }
};

export const getMenusByOrderId = async (orderId: string): Promise<DailyMenu[]> => {
    const { data, error } = await supabase
        .from('daily_menus')
        .select('*')
        .eq('order_id', orderId);

    if (error) {
        console.error('Error fetching menus by order ID:', error);
        return [];
    }
    return data as DailyMenu[];
};

export const getMenusByClientAndRange = async (clientId: string, startDate: string, endDate: string): Promise<DailyMenu[]> => {
    try {
        // 1. Get all order IDs belonging to this client
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id')
            .eq('client_id', clientId);

        if (ordersError || !orders || orders.length === 0) {
            return [];
        }

        const orderIds = orders.map(o => o.id);

        // 2. Fetch daily menus for these orders within the date range
        const { data, error } = await supabase
            .from('daily_menus')
            .select('*')
            .in('order_id', orderIds)
            .gte('menu_date', startDate)
            .lte('menu_date', endDate)
            .order('menu_date', { ascending: true });

        if (error) {
            console.error('Error fetching menus by client and range:', JSON.stringify(error, null, 2));
            return [];
        }

        return (data || []) as DailyMenu[];
    } catch (err) {
        console.error('Unexpected error in getMenusByClientAndRange:', err);
        return [];
    }
};
