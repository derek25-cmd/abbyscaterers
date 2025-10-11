-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS public.recipe_ingredients;
DROP TABLE IF EXISTS public.ingredients;
DROP TABLE IF EXISTS public.recipes;

-- Create Ingredients Table
CREATE TABLE public.ingredients (
    "itemNumber" TEXT PRIMARY KEY,
    "itemDescription" TEXT NOT NULL,
    "itemClassification" TEXT,
    units JSONB, -- Store units and prices as a JSON array of objects
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "quantityUsed" REAL,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Create Recipes Table
CREATE TABLE public.recipes (
    "recipeNumber" TEXT PRIMARY KEY,
    "recipeName" TEXT NOT NULL,
    "recipeType" TEXT,
    ingredients JSONB, -- Store ingredients as a JSON array of objects
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- RLS Policies for Ingredients
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view their own ingredients" ON public.ingredients
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert ingredients" ON public.ingredients
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own ingredients" ON public.ingredients
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own ingredients" ON public.ingredients
FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for Recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view their own recipes" ON public.recipes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert recipes" ON public.recipes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own recipes" ON public.recipes
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own recipes" ON public.recipes
FOR DELETE USING (auth.uid() = user_id);