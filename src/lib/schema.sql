
-- Create the sequence for recipe numbers
CREATE SEQUENCE IF NOT EXISTS recipes_recipe_number_seq;

-- Create the ingredients table with a user_id column
CREATE TABLE IF NOT EXISTS ingredients (
  "itemNumber" TEXT PRIMARY KEY,
  "itemDescription" TEXT NOT NULL,
  "itemClassification" TEXT,
  "units" JSONB,
  "user_id" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the recipes table with auto-generating recipeNumber and user_id
CREATE TABLE IF NOT EXISTS recipes (
  "recipeNumber" TEXT PRIMARY KEY DEFAULT 'RN-' || LPAD(nextval('recipes_recipe_number_seq')::TEXT, 5, '0'),
  "recipeName" TEXT NOT NULL,
  "recipeType" TEXT,
  "ingredients" JSONB,
  "user_id" UUID REFERENCES auth.users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Enable Row-Level Security for ingredients
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Policies for ingredients table
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON ingredients;
CREATE POLICY "Allow all access to authenticated users"
ON ingredients
FOR ALL
TO authenticated
USING (auth.uid() = user_id);


-- Enable Row-Level Security for recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Policies for recipes table
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON recipes;
CREATE POLICY "Allow all access to authenticated users"
ON recipes
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

