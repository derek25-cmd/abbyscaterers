
import { z } from "zod";
import { format } from "date-fns";
import { RECIPE_TYPES, REGIONS } from "@/types";

const isValidDate = (dateString?: string) => {
    if (!dateString) return false;
    return !isNaN(Date.parse(dateString));
};

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
  quantityUsed: z.number().optional(),
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
    "Evening Snacks",
    "Breakfast Bites",
] as const;

// ClientEvent schema
export const ClientEventRecipeSchema = z.object({
  recipeId: z.string().min(1, "Recipe selection cannot be empty"),
});

export const ClientEventSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().optional(),
  date: z.string().optional(),
  numberOfPeople: z.number().min(0, "Number of people cannot be negative.").optional(),
  mealType: z.string().optional(),
  recipes: z.array(ClientEventRecipeSchema).optional(),
  unitPrice: z.number().min(0, "Unit price must be a positive number").optional(),
  total: z.number().optional(),
  vatType: z.enum(['inclusive', 'exclusive']).optional(),
  particularType: z.enum(['event', 'meal', 'custom']).optional(),
  particularDescription: z.string().optional(),
  eventType: z.string().optional(),
  customEventType: z.string().optional(),
  region: z.enum(REGIONS).optional(),
});

// Order schema
export const OrderSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Order name is required"),
  clientId: z.string().min(1, "Customer selection is required"),
  startDate: z.string().refine((d) => isValidDate(d), "A valid start date is required"),
  endDate: z.string().refine((d) => isValidDate(d), "A valid end date is required"),
  description: z.string().optional(),
  proformaId: z.string().optional(),
  booking_id: z.string().nullable().optional(),
  clientEvents: z.array(ClientEventSchema).optional(),
});
export type OrderFormData = z.infer<typeof OrderSchema>;


// Shared Invoice Item Schema
export const InvoiceItemSchema = z.object({
  id: z.string(),
  orderId: z.string().optional(),
  eventType: z.string(),
  customEventType: z.string().optional(),
  mealType: z.string(),
  pax: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number(),
  date: z.string().optional(),
  particularType: z.enum(['event', 'meal', 'custom']),
  particularDescription: z.string().optional(),
  vatType: z.enum(['inclusive', 'exclusive']),
});
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

/**
 * Base Invoice Schema for shared validation across Proforma and Final Invoices.
 * Required for components like CloseBookingDialog.
 */
export const baseInvoiceSchema = z.object({
    id: z.string().optional(),
    invoiceDate: z.string().optional().or(z.literal('')),
    clientId: z.string().nullable().optional(),
    booking_id: z.string().nullable().optional(),
    receiverName: z.string().nullable().optional(),
    receiverPosition: z.string().nullable().optional(),
    lpoNumber: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    region: z.enum(REGIONS).nullable().optional(),
    numberOfDays: z.number().min(0).optional().default(1),
    multiplyByDays: z.boolean().default(false),
    serviceCharge: z.number().min(0).nullable().optional().default(0),
    transportCosts: z.number().min(0).nullable().optional().default(0),
    vatType: z.enum(['inclusive', 'exclusive']).nullable().optional().default('inclusive'),
    selectedEventType: z.string().nullable().optional(),
    customEventType: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    serviceFields: z.record(z.boolean()),
    serviceDesc: z.string().nullable().optional(),
    items: z.array(InvoiceItemSchema).min(1, "At least one item is required."),
    signedAtDate: z.string().nullable().optional(),
    signedAtLocation: z.string().nullable().optional(),
});

// Proforma Invoice Schema
export const ProformaInvoiceSchema = baseInvoiceSchema.extend({
    startDate: z.string().refine((d) => isValidDate(d), "A valid start date is required"),
    endDate: z.string().refine((d) => isValidDate(d), "A valid end date is required"),
    isInvoiced: z.boolean().optional(),
}).superRefine((data, ctx) => {
    const start = data.startDate ? new Date(data.startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    
    const end = data.endDate ? new Date(data.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    if (start && end && start > end) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End date cannot be before start date",
            path: ["endDate"],
        });
    }

    if (start && end) {
        data.items.forEach((item, index) => {
            if (item.date && isValidDate(item.date)) {
                const itemDate = new Date(item.date);
                if (itemDate < start || itemDate > end) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Item #${index + 1} date must be within range ${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`,
                        path: ["items", index, "date"],
                    });
                }
            }
        });
    }
});

export type ProformaInvoiceFormData = z.infer<typeof ProformaInvoiceSchema>;


// Final Invoice Schema
export const FinalInvoiceSchema = baseInvoiceSchema.extend({
    proformaId: z.string().optional(),
    status: z.enum(['outstanding', 'paid', 'partially paid']),
    paymentDate: z.string().optional().nullable(),
    appendProformaId: z.boolean().optional(),
    amountPaid: z.number().optional().default(0),
    startDate: z.string().refine((d) => isValidDate(d), "A valid start date is required"),
    endDate: z.string().refine((d) => isValidDate(d), "A valid end date is required"),
}).superRefine((data, ctx) => {
    const start = data.startDate ? new Date(data.startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    
    const end = data.endDate ? new Date(data.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    if (start && end && start > end) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End date cannot be before start date",
            path: ["endDate"],
        });
    }

    if (start && end) {
        data.items.forEach((item, index) => {
            if (item.date && isValidDate(item.date)) {
                const itemDate = new Date(item.date);
                if (itemDate < start || itemDate > end) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Item #${index + 1} date must be within range ${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`,
                        path: ["items", index, "date"],
                    });
                }
            }
        });
    }
});


export type FinalInvoiceFormData = z.infer<typeof FinalInvoiceSchema>;


// --- CONTINUOUS INVOICING / BOOKING ---
export const BookingSchema = z.object({
  id: z.string().optional(), 
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Booking name is required"),
  start_date: z.string().refine((d) => isValidDate(d), "A valid start date is required"),
  end_date: z.string().refine((d) => isValidDate(d), "A valid end date is required"),
  status: z.enum(['active', 'closed', 'pending']),
  proforma_invoice_id: z.string().nullable().optional(),
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


// Delivery Note Schema
export const DeliveryNoteItemSchema = z.object({
  qty: z.number().min(1, "Quantity must be at least 1"),
  itemCode: z.string().min(1, "Item code is required"),
  description: z.string().min(1, "Description is required"),
});

export const DeliveryNoteSchema = z.object({
  id: z.string().min(1, "Delivery note number is required"),
  orderId: z.string(),
  clientId: z.string(),
  deliveryDate: z.string().refine((d) => isValidDate(d), "A valid date is required"),
  deliveryLocation: z.string().min(1, "Delivery location is required"),
  vehicleRegNo: z.string().optional(),
  deliveredBy: z.string().min(1, "Delivered by is required"),
  items: z.array(DeliveryNoteItemSchema).min(1, "At least one item is required"),
});
export type DeliveryNoteFormData = z.infer<typeof DeliveryNoteSchema>;


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


// --- MENU COSTING ---
export const CateringMenuSchema = z.object({
    name: z.string().min(1, "Menu name is required"),
    menu_type_id: z.string().min(1, "Menu type is required"),
    base_people: z.number().int().min(1, "Base people must be at least 1"),
    price_per_person: z.number().min(0, "Price per person cannot be negative"),
    notes: z.string().optional(),
});
export type CateringMenuFormData = z.infer<typeof CateringMenuSchema>;

export const MenuCalculateInputSchema = z.object({
    people: z.number().int().min(1, "Number of people must be at least 1"),
    useWastage: z.boolean().default(false),
});
export type MenuCalculateInput = z.infer<typeof MenuCalculateInputSchema>;
