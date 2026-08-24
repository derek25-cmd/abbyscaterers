-- Create the sequence for recipe numbers
CREATE SEQUENCE IF NOT EXISTS recipes_recipe_number_seq START 1;

-- Create the ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  "itemNumber" TEXT PRIMARY KEY,
  "itemDescription" TEXT NOT NULL,
  "itemClassification" TEXT,
  "units" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "user_id" UUID REFERENCES auth.users(id)
);

-- Create the recipes table without the default value first
CREATE TABLE IF NOT EXISTS recipes (
  "recipeNumber" TEXT PRIMARY KEY,
  "recipeName" TEXT NOT NULL,
  "recipeType" TEXT,
  "ingredients" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "user_id" UUID REFERENCES auth.users(id)
);

-- Now, alter the table to add the default value using the sequence
ALTER TABLE recipes
ALTER COLUMN "recipeNumber"
SET DEFAULT 'RN-' || LPAD(nextval('recipes_recipe_number_seq')::TEXT, 5, '0');

-- Enable Row-Level Security (RLS)
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
-- Drop existing policies first to avoid errors on re-run
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON ingredients;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON recipes;

CREATE POLICY "Allow all access for authenticated users"
ON ingredients
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow all access for authenticated users"
ON recipes
FOR ALL
TO authenticated
USING (auth.uid() = user_id);


-- FIX FOR IMPORTED DATA --
-- If you have imported data directly into Supabase and it's not appearing,
-- it's because the 'user_id' for those rows is NULL.
-- Run the following UPDATE statement in your Supabase SQL editor to assign
-- your user ID to any recipes that are missing it.

-- How to find your User ID:
-- 1. In Supabase, go to "Authentication" -> "Users".
-- 2. Find your user account and click on it.
-- 3. Copy the "User UID" from the details panel.

-- Then, uncomment the line below and replace 'YOUR_USER_ID_HERE' with your actual User ID.

-- UPDATE public.recipes
-- SET user_id = 'YOUR_USER_ID_HERE'
-- WHERE user_id IS NULL;
