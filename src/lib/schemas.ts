import { z } from "zod";

// DietaryClassification schema
export const DietaryClassificationSchema = z.object({
  restriction: z.string(),
  category: z.string(),
  isAmbiguous: z.boolean(),
});

// Client schema
export const ClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email().min(1, "A valid email is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  address1: z.string().min(1, "Address 1 is required"),
  address2: z.string().optional(),
  primaryLocation: z.string().min(1, "Primary location is required"),
  lastContacted: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
});

export type ClientFormData = z.infer<typeof ClientSchema>;


// Equipment schema
export const EquipmentSchema = z.object({
  equipmentNumber: z.string().min(1, "Equipment number is required"),
  equipmentName: z.string().min(1, "Equipment name is required"),
  oem: z.string().optional(),
  model: z.string().optional(),
  powerRating: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  yearOfManufacture: z.string().optional(),
  equipmentSource: z.string().min(1, "Equipment source is required"),
  capacity: z.string().optional(),
  commitment: z.string().min(1, "Commitment status is required"),
  registrationNumber: z.string().optional(),
});
export type EquipmentFormData = z.infer<typeof EquipmentSchema>;


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
  price: z.number().min(0, "Price cannot be negative"),
});

// Ingredient schema
export const IngredientSchema = z.object({
  itemNumber: z.string().min(1, "Item number is required"),
  itemDescription: z.string().min(1, "Item description is required"),
  itemClassification: ItemClassificationSchema,
  units: z
    .array(UnitAndPriceSchema)
    .min(1, "At least one unit of measure is required"),
});
export type IngredientFormData = z.infer<typeof IngredientSchema>;


// RecipeIngredientItem schema
export const RecipeIngredientItemSchema = z.object({
  ingredientId: z.string().min(1, "Ingredient must be selected"),
  quantity: z.number().gt(0, "Quantity must be greater than 0"),
  unit: UnitOfMeasureSchema,
});

// Recipe schema
export const RecipeSchema = z.object({
  recipeNumber: z.string().min(1, "Recipe number is required"),
  recipeName: z.string().min(1, "Recipe name is required"),
  ingredients: z
    .array(RecipeIngredientItemSchema)
    .min(1, "At least one ingredient is required"),
});

export type RecipeFormData = z.infer<typeof RecipeSchema>;


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
export const ClientEventRecipeSchema = z.object({
  recipeId: z.string().min(1, "Recipe selection cannot be empty"),
});

export const ClientEventSchema = z.object({
  clientId: z.string().min(1, "Client must be selected"),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "A valid date is required",
  }),
  numberOfPeople: z.number().min(1, "Number of people must be at least 1"),
  mealType: MealTypeSchema,
  recipes: z
    .array(ClientEventRecipeSchema)
    .min(1, "At least one recipe is required for an event"),
});

// DailyMenu schema
export const DailyMenuSchema = z.object({
  id: z.string().min(1, "Menu ID is required"),
  name: z.string().min(1, "Menu name is required"),
  clientEvents: z.array(ClientEventSchema).min(1, "At least one client event is required"),
});
export type DailyMenuFormData = z.infer<typeof DailyMenuSchema>;


// Invoice Schema
export const InvoiceItemSchema = z.object({
  id: z.string(),
  eventType: z.string().min(1),
  customEventType: z.string().optional(),
  mealType: z.string().min(1),
  pax: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number(),
  date: z.string().optional(),
  particularType: z.enum(['event', 'meal']),
});

export const InvoiceSchema = z.object({
  id: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().optional(),
  clientId: z.string().nullable(),
  receiverName: z.string(),
  receiverPosition: z.string(),
  lpoNumber: z.string(),
  location: z.string(),
  numberOfDays: z.number().min(1),
  multiplyByDays: z.boolean(),
  serviceCharge: z.number().min(0),
  transportCosts: z.number().min(0),
  vatType: z.enum(['inclusive', 'exclusive']),
  selectedEventType: z.string(),
  customEventType: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  serviceFields: z.record(z.boolean()),
  serviceDesc: z.string(),
  items: z.array(InvoiceItemSchema).min(1, "At least one item is required."),
});

export type InvoiceFormData = z.infer<typeof InvoiceSchema>;
