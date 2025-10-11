-- Drop existing tables (optional, but good for a clean start if they exist)
DROP TABLE IF EXISTS "recipe_ingredients";
DROP TABLE IF EXISTS "recipes";
DROP TABLE IF EXISTS "ingredients";

-- Create Ingredients Table
CREATE TABLE "ingredients" (
  "itemNumber" TEXT PRIMARY KEY,
  "itemDescription" TEXT NOT NULL,
  "itemClassification" TEXT,
  "units" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN "ingredients"."itemNumber" IS 'User-facing No. and unique ID';
COMMENT ON COLUMN "ingredients"."itemDescription" IS 'Description of the ingredient';
COMMENT ON COLUMN "ingredients"."itemClassification" IS 'Classification like Fruit, Vegetable, etc.';
COMMENT ON COLUMN "ingredients"."units" IS 'Array of units and prices, e.g., [{"unit": "kg", "price": 10.99}]';


-- Create Recipes Table
CREATE TABLE "recipes" (
  "recipeNumber" TEXT PRIMARY KEY,
  "recipeName" TEXT NOT NULL,
  "recipeType" TEXT,
  "ingredients" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN "recipes"."recipeNumber" IS 'User-facing unique ID for the recipe';
COMMENT ON COLUMN "recipes"."recipeName" IS 'Name of the food created from the recipe';
COMMENT ON COLUMN "recipes"."recipeType" IS 'Type of recipe, e.g., Breakfast, Lunch, Dinner';
COMMENT ON COLUMN "recipes"."ingredients" IS 'Array of ingredients, e.g., [{"ingredientId": "ING-001", "quantity": 2, "unit": "kg"}]';


-- Optional: Enable Row-Level Security (RLS) on the new tables
-- You should do this and define policies in the Supabase UI for security.
ALTER TABLE "ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;

-- Example RLS Policy (adjust as needed in Supabase UI):
-- Allows authenticated users to read all recipes and ingredients.
-- CREATE POLICY "Allow read access to authenticated users"
-- ON "recipes"
-- FOR SELECT
-- TO authenticated
-- USING (true);

-- CREATE POLICY "Allow read access to authenticated users on ingredients"
-- ON "ingredients"
-- FOR SELECT
-- TO authenticated
-- USING (true);

-- You would also need policies for INSERT, UPDATE, DELETE based on your app's logic.
