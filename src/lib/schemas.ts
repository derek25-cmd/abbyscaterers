
import { z } from "zod";
import { RECIPE_TYPES } from "@/types";

// DietaryClassification schema
export const DietaryClassificationSchema = z.object({
  restriction: z.string(),
  category: z.string(),
  isAmbiguous: z.boolean(),
});

// Organization Types
export const ORGANIZATION_TYPES = [
  "Industrial", "Commercial", "Financial", "Service", "Agricultural",
  "Educational", "Medical", "Technological", "Entertainment and Media",
  "Legal", "Military", "Governmental", "Religious", "NGO", "Public Health"
] as const;

// Contact Schema
export const ContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Contact phone is required"),
});

// Client schema
export const ClientSchema = z.object({
  id: z.string().min(1, "Customer Registration Number is required"),
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email("Invalid email address").optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  address1: z.string().min(1, "Address 1 is required"),
  address2: z.string().optional().refine(
    (val) => !val || val.toUpperCase().startsWith("P.O.BOX"),
    { message: "Address 2 must start with 'P.O.BOX'" }
  ),
  primaryLocation: z.string().min(1, "Primary location is required"),
  typeOfOrganization: z.enum(ORGANIZATION_TYPES),
  postalCode: z.string().optional(),
  lastContacted: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid ISO date string",
  }),
  contacts: z.array(ContactSchema).optional(),
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
  recipeNumber: z.string().optional(),
  recipeName: z.string().min(1, "Recipe name is required"),
  recipeType: z.enum(RECIPE_TYPES),
  ingredients: z.array(RecipeIngredientItemSchema).optional(),
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
    .array(ClientEventRecipeSchema),
  unitPrice: z.number().min(0, "Unit price must be a positive number"),
  total: z.number().optional(),
  vatType: z.enum(['inclusive', 'exclusive']),
});

// Order schema
export const OrderSchema = z.object({
  id: z.string().min(1, "Order ID is required"),
  name: z.string().min(1, "Order name is required"),
  description: z.string().optional(),
  proformaId: z.string().optional(),
  booking_id: z.string().optional(),
  clientEvents: z.array(ClientEventSchema).min(1, "At least one client event is required"),
});
export type OrderFormData = z.infer<typeof OrderSchema>;


// Shared Invoice Item Schema
export const InvoiceItemSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  customEventType: z.string().optional(),
  mealType: z.string(),
  pax: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number(),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "A valid date is required",
  }),
  particularType: z.enum(['event', 'meal']),
  particularDescription: z.string().optional(),
  vatType: z.enum(['inclusive', 'exclusive']),
});
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;


// Proforma Invoice Schema
const isValidDate = (dateString?: string) => {
    if (!dateString) return false;
    return !isNaN(Date.parse(dateString));
};

export const baseInvoiceSchema = z.object({
    id: z.string().optional(),
    invoiceDate: z.string().refine((d) => isValidDate(d), "A valid date is required"),
    clientId: z.string().nullable().optional(),
    receiverName: z.string().optional(),
    receiverPosition: z.string().optional(),
    lpoNumber: z.string().optional(),
    location: z.string().optional(),
    numberOfDays: z.number().min(1),
    multiplyByDays: z.boolean(),
    serviceCharge: z.number().min(0),
    transportCosts: z.number().min(0),
    vatType: z.enum(['inclusive', 'exclusive']),
    selectedEventType: z.string().optional(),
    customEventType: z.string().optional(),
    startDate: z.string().refine((d) => isValidDate(d), "A valid start date is required"),
    endDate: z.string().refine((d) => isValidDate(d), "A valid end date is required"),
    serviceFields: z.record(z.boolean()),
    serviceDesc: z.string().optional(),
    items: z.array(InvoiceItemSchema).min(1, "At least one item is required."),
});

export const ProformaInvoiceSchema = baseInvoiceSchema.refine(data => {
    const start = new Date(data.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(data.endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) return false;

    // Check if each item date is within the range (inclusive)
    for (const item of data.items) {
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        if (itemDate < start || itemDate > end) {
            return false;
        }
    }
    return true;
}, {
    message: "End date cannot be before start date, and all item dates must be within the start and end date range.",
    path: ["endDate"], 
});

export type ProformaInvoiceFormData = z.infer<typeof ProformaInvoiceSchema>;


// Final Invoice Schema
export const FinalInvoiceSchema = baseInvoiceSchema.extend({
    proformaId: z.string().optional(),
    status: z.enum(['outstanding', 'paid']),
    signedAtDate: z.string().optional(),
    signedAtLocation: z.string().optional(),
});


export type FinalInvoiceFormData = z.infer<typeof FinalInvoiceSchema>;


// --- CONTINUOUS INVOICING / BOOKING ---
export const BookingSchema = z.object({
  id: z.string().optional(), // ID is optional now, will be generated by Supabase
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Booking name is required"),
  start_date: z.string().refine((d) => isValidDate(d), "A valid start date is required"),
  end_date: z.string().refine((d) => isValidDate(d), "A valid end date is required"),
  status: z.enum(['active', 'closed', 'pending']),
}).refine(data => new Date(data.start_date) <= new Date(data.end_date), {
  message: "End date cannot be before start date",
  path: ["end_date"],
});
export type BookingFormData = z.infer<typeof BookingSchema>;

export const DailyOrderSchema = z.object({
  id: z.string().optional(),
  bookingId: z.string(),
  orderDate: z.string().refine((d) => isValidDate(d), "A valid order date is required"),
  menu: z.string().min(1, "Menu description is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  total: z.number(),
});
export type DailyOrderFormData = z.infer<typeof DailyOrderSchema>;


// HR Schemas
export const DEPARTMENTS = ["Kitchen", "Service", "Management", "Logistics", "Sales"] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"] as const;

export const EmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  fullName: z.string().min(1, "Full name is required"),
  position: z.string().min(1, "Position is required"),
  department: z.enum(DEPARTMENTS),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  dateOfBirth: z.string().optional(),
  hireDate: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Invalid hire date" }),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().optional(),
});
export type EmployeeFormData = z.infer<typeof EmployeeSchema>;
