-- ============================================================
-- Recipe-Based Dynamic Costing System — Schema Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Menu Types (lookup table)
CREATE TABLE IF NOT EXISTS public.menu_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

INSERT INTO public.menu_types (name) VALUES
    ('breakfast'),
    ('brunch'),
    ('lunch'),
    ('dinner')
ON CONFLICT (name) DO NOTHING;

-- 2. Catering Menus
CREATE TABLE IF NOT EXISTS public.catering_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    menu_type_id UUID NOT NULL REFERENCES public.menu_types(id),
    base_people INTEGER NOT NULL DEFAULT 1 CHECK (base_people >= 1),
    price_per_person NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price_per_person >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- 3. Catering Menu Recipes (junction → existing recipes table)
CREATE TABLE IF NOT EXISTS public.catering_menu_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES public.catering_menus(id) ON DELETE CASCADE,
    recipe_number TEXT NOT NULL REFERENCES public.recipes("recipeNumber") ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (menu_id, recipe_number)
);

-- 4. Menu Planned Ingredients (user-inputted budget for comparison)
CREATE TABLE IF NOT EXISTS public.menu_planned_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES public.catering_menus(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    planned_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (planned_quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_catering_menus_type ON public.catering_menus(menu_type_id);
CREATE INDEX IF NOT EXISTS idx_catering_menu_recipes_menu ON public.catering_menu_recipes(menu_id);
CREATE INDEX IF NOT EXISTS idx_catering_menu_recipes_recipe ON public.catering_menu_recipes(recipe_number);
CREATE INDEX IF NOT EXISTS idx_menu_planned_ingredients_menu ON public.menu_planned_ingredients(menu_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.menu_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catering_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catering_menu_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_planned_ingredients ENABLE ROW LEVEL SECURITY;

-- menu_types: readable by all authenticated users
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.menu_types;
CREATE POLICY "Allow read for authenticated users"
    ON public.menu_types FOR SELECT
    TO authenticated
    USING (true);

-- catering_menus: full access for the owner
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.catering_menus;
CREATE POLICY "Allow all access for authenticated users"
    ON public.catering_menus FOR ALL
    TO authenticated
    USING (auth.uid() = user_id);

-- catering_menu_recipes: full access if parent menu is owned
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.catering_menu_recipes;
CREATE POLICY "Allow all access for authenticated users"
    ON public.catering_menu_recipes FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.catering_menus
            WHERE id = menu_id AND user_id = auth.uid()
        )
    );

-- menu_planned_ingredients: full access if parent menu is owned
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.menu_planned_ingredients;
CREATE POLICY "Allow all access for authenticated users"
    ON public.menu_planned_ingredients FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.catering_menus
            WHERE id = menu_id AND user_id = auth.uid()
        )
    );
