import { z } from "zod";

// DietaryClassification schema
export const DietaryClassificationSchema = z.object({
  restriction: z.string(),
  category: z.string(),
  isAmbiguous: z.boolean(),
});

// Client schema
export const ClientSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  companyEmail: z.string().email(),
  phoneNumber: z.string(),
  address1: z.string(),
  address2: z.string().optional(),
  primaryLocation: z.string(),
  lastContacted: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  createdAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  updatedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
});

// Equipment schema
export const EquipmentSchema = z.object({
  equipmentNumber: z.string(),
  equipmentName: z.string(),
  oem: z.string().optional(),
  model: z.string().optional(),
  powerRating: z.string().optional(),
  quantity: z.number(),
  yearOfManufacture: z.string().optional(),
  equipmentSource: z.string().optional(),
  capacity: z.string().optional(),
  commitment: z.string().optional(),
  registrationNumber: z.string().optional(),
  createdAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  updatedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
});

// ItemClassification enum values
export const ITEM_CLASSIFICATIONS = [
  "Herbes & Spices",
  "Fruits",
  "Vegetables",
  "Starch",
  "Protein",
  "Ingredient",
  "Cereal",
] as const;
export const ItemClassificationSchema = z.enum(ITEM_CLASSIFICATIONS);

// UnitOfMeasure enum values
export const UNITS_OF_MEASURE = ["kg", "gms", "bunch", "item"] as const;
export const UnitOfMeasureSchema = z.enum(UNITS_OF_MEASURE);

// UnitAndPrice schema
export const UnitAndPriceSchema = z.object({
  unit: UnitOfMeasureSchema,
  price: z.number(),
});

// Ingredient schema
export const IngredientSchema = z.object({
  itemNumber: z.string(),
  itemDescription: z.string(),
  itemClassification: ItemClassificationSchema,
  units: z.array(UnitAndPriceSchema),
  createdAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  updatedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
});

// RecipeIngredientItem schema
export const RecipeIngredientItemSchema = z.object({
  ingredientId: z.string(),
  quantity: z.number(),
  unit: UnitOfMeasureSchema,
});

// Recipe schema
export const RecipeSchema = z.object({
  recipeNumber: z.string(),
  recipeName: z.string(),
  ingredients: z.array(RecipeIngredientItemSchema),
  createdAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  updatedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
});

// MealType enum values
export const MEAL_TYPES = [
  "Breakfast only",
  "Lunch only",
  "Dinner only",
  "Breakfast and lunch",
  "Brunch",
  "Breakfast, lunch and evening tea",
  "Breakfast, lunch and dinner",
  "Evening tea",
] as const;
export const MealTypeSchema = z.enum(MEAL_TYPES);

// ClientEvent schema
export const ClientEventSchema = z.object({
  clientId: z.string(),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  numberOfPeople: z.number(),
  mealType: MealTypeSchema,
  recipes: z.array(
    z.object({
      recipeId: z.string(),
    })
  ),
});

// DailyMenu schema
export const DailyMenuSchema = z.object({
  id: z.string(),
  name: z.string(),
  clientEvents: z.array(ClientEventSchema),
  createdAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  updatedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
});
