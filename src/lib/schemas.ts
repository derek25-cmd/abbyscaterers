
import { z } from "zod";
import { ITEM_CLASSIFICATIONS, UNITS_OF_MEASURE } from "@/types";

// This schema can remain if other parts of the app use it,
// but it's no longer directly part of the Client schema.
export const dietaryClassificationSchema = z.object({
  restriction: z.string(),
  category: z.string(),
  isAmbiguous: z.boolean(),
});

export const clientSchema = z.object({
  id: z.string().min(1, { message: "Client ID is required." }), 
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyEmail: z.string().email({ message: "Invalid company email address." }),
  phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  address1: z.string().min(5, { message: "Address 1 must be at least 5 characters." }),
  address2: z.string().optional(),
  primaryLocation: z.string().min(2, { message: "Primary location must be at least 2 characters." }),
  lastContacted: z.string().datetime({ message: "Invalid date format for last contacted." }),
  createdAt: z.string().datetime().optional(), // Optional for creation
  updatedAt: z.string().datetime().optional(), // Optional for creation
});

export type ClientFormData = z.infer<typeof clientSchema>;

export const equipmentSchema = z.object({
  equipmentNumber: z.string().min(1, { message: "Equipment No. is required." }),
  equipmentName: z.string().min(2, { message: "Equipment name must be at least 2 characters." }),
  oem: z.string().optional(),
  model: z.string().optional(),
  powerRating: z.string().optional(),
  quantity: z.coerce.number().int().positive({ message: "Quantity must be a positive number." }),
  yearOfManufacture: z.string().optional(), // Or z.coerce.number().int().min(1900).max(new Date().getFullYear()) if numeric
  equipmentSource: z.string().optional(),
  capacity: z.string().optional(),
  commitment: z.string().optional(),
  registrationNumber: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type EquipmentFormData = z.infer<typeof equipmentSchema>;

export const unitAndPriceSchema = z.object({
  unit: z.enum(UNITS_OF_MEASURE, {
    errorMap: () => ({ message: "Please select a valid unit." }),
  }),
  price: z.coerce.number().positive({ message: "Price must be a positive number." }),
});

export const ingredientSchema = z.object({
  itemNumber: z.string().min(1, { message: "Item No. is required." }),
  itemDescription: z.string().min(2, { message: "Item description must be at least 2 characters." }),
  itemClassification: z.enum(ITEM_CLASSIFICATIONS, {
    errorMap: () => ({ message: "Please select a valid item classification." }),
  }),
  units: z.array(unitAndPriceSchema).min(1, { message: "At least one unit of measure and price is required." }),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type IngredientFormData = z.infer<typeof ingredientSchema>;

export const recipeIngredientItemSchema = z.object({
  ingredientId: z.string().min(1, "Ingredient selection is required."),
  quantity: z.coerce.number().positive({ message: "Quantity must be a positive number." }),
  unit: z.enum(UNITS_OF_MEASURE, {
    errorMap: () => ({ message: "Please select a valid unit." }),
  }),
});

export type RecipeIngredientItemFormData = z.infer<typeof recipeIngredientItemSchema>;

export const recipeSchema = z.object({
  recipeNumber: z.string().min(1, { message: "Recipe No. is required." }),
  recipeName: z.string().min(2, { message: "Recipe name must be at least 2 characters." }),
  ingredients: z.array(recipeIngredientItemSchema).min(1, { message: "At least one ingredient is required." }),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type RecipeFormData = z.infer<typeof recipeSchema>;

export const dailyMenuItemSchema = z.object({
  recipeId: z.string().min(1, "Recipe selection is required."),
});

export const dailyMenuSchema = z.object({
  id: z.string().min(1, { message: "Menu ID is required." }),
  name: z.string().min(2, { message: "Menu name must be at least 2 characters." }),
  date: z.string().datetime({ message: "Invalid date format for menu date." }),
  items: z.array(dailyMenuItemSchema).min(1, { message: "At least one recipe is required." }),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type DailyMenuFormData = z.infer<typeof dailyMenuSchema>;
