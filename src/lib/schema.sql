-- Drop tables if they exist to start fresh (optional, for clean slate)
DROP TABLE IF EXISTS "recipe_ingredients";
DROP TABLE IF EXISTS "recipes";
DROP TABLE IF EXISTS "ingredients";

-- Drop sequence if it exists
DROP SEQUENCE IF EXISTS recipes_recipe_number_seq;

-- 1. Create the sequence for recipe numbers
CREATE SEQUENCE recipes_recipe_number_seq START 1;

-- 2. Create the recipes table without the default value initially
CREATE TABLE "recipes" (
    "recipeNumber" TEXT PRIMARY KEY,
    "recipeName" TEXT NOT NULL,
    "recipeType" TEXT,
    "ingredients" JSONB,
    "user_id" UUID REFERENCES auth.users(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Alter the table to set the default value using the sequence
ALTER TABLE "recipes"
ALTER COLUMN "recipeNumber" SET DEFAULT 'RN-' || LPAD(nextval('recipes_recipe_number_seq')::TEXT, 5, '0');

-- Create the ingredients table
CREATE TABLE "ingredients" (
    "itemNumber" TEXT PRIMARY KEY,
    "itemDescription" TEXT NOT NULL,
    "itemClassification" TEXT,
    "units" JSONB,
    "user_id" UUID REFERENCES auth.users(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "quantityUsed" REAL
);

-- Enable Row-Level Security for recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Policies for recipes table
DROP POLICY IF EXISTS "Authenticated users can perform all operations on their own recipes" ON recipes;
CREATE POLICY "Authenticated users can perform all operations on their own recipes"
ON recipes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable Row-Level Security for ingredients
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Policies for ingredients table
DROP POLICY IF EXISTS "Authenticated users can perform all operations on their own ingredients" ON ingredients;
CREATE POLICY "Authenticated users can perform all operations on their own ingredients"
ON ingredients
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);