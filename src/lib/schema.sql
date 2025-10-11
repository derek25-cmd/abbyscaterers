-- Enable the pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgrst" WITH SCHEMA "public";

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS "public"."recipe_ingredients";
DROP TABLE IF EXISTS "public"."recipes";
DROP TYPE IF EXISTS "public"."recipe_type";

-- Create an ENUM type for the recipe types. This ensures data consistency.
CREATE TYPE "public"."recipe_type" AS ENUM (
    'Breakfast',
    'Lunch',
    'Dinner',
    'Evening Tea'
);

-- Create the main 'recipes' table
-- This table stores the core information for each recipe.
CREATE TABLE "public"."recipes" (
    "recipeNumber" TEXT NOT NULL PRIMARY KEY,
    "recipeName" TEXT NOT NULL,
    "recipeType" public.recipe_type,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments for recipes table
COMMENT ON TABLE "public"."recipes" IS 'Stores the core information for each recipe.';
COMMENT ON COLUMN "public"."recipes"."recipeNumber" IS 'The unique identifier for the recipe (e.g., REC-001).';
COMMENT ON COLUMN "public"."recipes"."recipeName" IS 'The name of the food created from the recipe.';
COMMENT ON COLUMN "public"."recipes"."recipeType" IS 'The type of meal the recipe is for (e.g., Breakfast, Lunch).';


-- Create the 'recipe_ingredients' table
-- This table links ingredients to recipes, forming a many-to-many relationship.
-- It details which ingredients, and in what quantity, are needed for each recipe.
CREATE TABLE "public"."recipe_ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    "recipeNumber" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "recipe_ingredients_recipeNumber_fkey" FOREIGN KEY ("recipeNumber") REFERENCES "public"."recipes"("recipeNumber") ON DELETE CASCADE,
    CONSTRAINT "recipe_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "public"."ingredients"("itemNumber") ON DELETE SET NULL
);

-- Comments for recipe_ingredients table
COMMENT ON TABLE "public"."recipe_ingredients" IS 'Links ingredients to recipes, specifying quantities and units for each.';
COMMENT ON COLUMN "public"."recipe_ingredients"."recipeNumber" IS 'Foreign key referencing the recipe.';
COMMENT ON COLUMN "public"."recipe_ingredients"."ingredientId" IS 'Foreign key referencing the ingredient.';


-- Create indexes to improve query performance on foreign keys.
CREATE INDEX "idx_recipe_ingredients_recipeNumber" ON "public"."recipe_ingredients" USING btree ("recipeNumber");
CREATE INDEX "idx_recipe_ingredients_ingredientId" ON "public"."recipe_ingredients" USING btree ("ingredientId");

-- Grant permissions to Supabase roles
GRANT ALL ON TABLE "public"."recipes" TO "service_role";
GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";

GRANT ALL ON TABLE "public"."recipe_ingredients" TO "service_role";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "authenticated";
