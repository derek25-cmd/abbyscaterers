-- Enable Row-Level Security
ALTER TABLE
  ingredients ENABLE ROW LEVEL SECURITY;

ALTER TABLE
  recipes ENABLE ROW LEVEL SECURITY;

-- Create policies for ingredients
CREATE POLICY "Allow authenticated users to see their own ingredients" ON ingredients FOR
SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert their own ingredients" ON ingredients FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own ingredients" ON ingredients FOR
UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own ingredients" ON ingredients FOR DELETE USING (auth.uid() = user_id);

-- Create policies for recipes
CREATE POLICY "Allow authenticated users to see their own recipes" ON recipes FOR
SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert their own recipes" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own recipes" ON recipes FOR
UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own recipes" ON recipes FOR DELETE USING (auth.uid() = user_id);

-- Create the sequence for recipe numbers
CREATE SEQUENCE IF NOT EXISTS recipes_recipe_number_seq START 1;

-- Create the ingredients table
CREATE TABLE
  ingredients (
    "itemNumber" TEXT PRIMARY KEY,
    "itemDescription" TEXT NOT NULL,
    "itemClassification" TEXT NOT NULL,
    units JSONB, -- Store units and prices as a JSON array of objects
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users (id) DEFAULT auth.uid()
  );

-- Create the recipes table
CREATE TABLE
  recipes (
    "recipeNumber" TEXT PRIMARY KEY DEFAULT 'RN-' || LPAD(nextval('recipes_recipe_number_seq'::regclass)::TEXT, 5, '0'),
    "recipeName" TEXT NOT NULL,
    "recipeType" TEXT,
    ingredients JSONB, -- Store ingredients as a JSON array of objects
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users (id) DEFAULT auth.uid()
  );
