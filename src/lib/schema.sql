-- Create the ingredients table
CREATE TABLE ingredients (
  "itemNumber" TEXT PRIMARY KEY,
  "itemDescription" TEXT NOT NULL,
  "itemClassification" TEXT,
  "units" JSONB,
  "user_id" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "quantityUsed" REAL DEFAULT 0
);

-- Create the recipes table
CREATE TABLE recipes (
  "recipeNumber" TEXT PRIMARY KEY,
  "recipeName" TEXT NOT NULL,
  "recipeType" TEXT,
  "ingredients" JSONB,
  "user_id" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security for ingredients
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- Create policy for ingredients
CREATE POLICY "Enable all for authenticated users" ON public.ingredients
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable Row-Level Security for recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Create policy for recipes
CREATE POLICY "Enable all for authenticated users" ON public.recipes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
