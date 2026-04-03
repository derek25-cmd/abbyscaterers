-- ============================================================
-- Core Ingredients & Recipe Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Ingredients Master Table
CREATE TABLE IF NOT EXISTS public.ingredients (
    "itemNumber" TEXT PRIMARY KEY,
    "itemDescription" TEXT NOT NULL,
    "itemClassification" TEXT NOT NULL,
    "units" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Ensure user_id column exists if table was created manually before
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ingredients' AND column_name='user_id') THEN
        ALTER TABLE public.ingredients ADD COLUMN "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Recipes Table
CREATE TABLE IF NOT EXISTS public.recipes (
    "recipeNumber" TEXT PRIMARY KEY,
    "recipeName" TEXT NOT NULL,
    "recipeType" TEXT,
    "ingredients" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recipes' AND column_name='user_id') THEN
        ALTER TABLE public.recipes ADD COLUMN "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Products Table (Inventory)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
    unit TEXT,
    "unitPrice" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "minStock" NUMERIC(12, 4) DEFAULT 0,
    "maxStock" NUMERIC(12, 4),
    "expiryDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='user_id') THEN
        ALTER TABLE public.products ADD COLUMN "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ingredients_classification ON public.ingredients("itemClassification");
CREATE INDEX IF NOT EXISTS idx_ingredients_description ON public.ingredients("itemDescription");
CREATE INDEX IF NOT EXISTS idx_recipes_name ON public.recipes("recipeName");
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policy: Ingredients
DROP POLICY IF EXISTS "Owner access to ingredients" ON public.ingredients;
CREATE POLICY "Owner access to ingredients" 
    ON public.ingredients FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id);

-- Policy: Recipes
DROP POLICY IF EXISTS "Owner access to recipes" ON public.recipes;
CREATE POLICY "Owner access to recipes" 
    ON public.recipes FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id);

-- Policy: Products
DROP POLICY IF EXISTS "Owner access to products" ON public.products;
CREATE POLICY "Owner access to products" 
    ON public.products FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id);

-- ============================================================
-- Automatic updated_at Triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
