

export const ORGANIZATION_TYPES = [
  "Industrial", "Commercial", "Financial", "Service", "Agricultural",
  "Educational", "Medical", "Technological", "Entertainment and Media",
  "Legal", "Military", "Governmental", "Religious", "NGO", "Public Health"
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export interface DietaryClassification {
  restriction: string;
  category: string;
  isAmbiguous: boolean;
}

export interface Contact {
  name: string;
  email: string;
  phone: string;
}

export interface Client {
  id: string; // Customer Registration Number
  companyName: string;
  companyEmail?: string;
  phoneNumber?: string;
  address1: string;
  address2?: string;
  postalCode?: string;
  primaryLocation: string;
  typeOfOrganization: OrganizationType;
  contacts: Contact[];
  lastContacted: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Equipment {
  equipmentNumber: string; // User-facing "No." and unique ID
  equipmentName: string;
  oem?: string;
  model?: string;
  powerRating?: string;
  quantity: number;
  yearOfManufacture?: string;
  equipmentSource?: string;
  capacity?: string;
  commitment?: string;
  registrationNumber?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export const ITEM_CLASSIFICATIONS = [
  "Herbes & Spices",
  "Fruits",
  "Vegetables",
  "Starch",
  "Protein",
  "Ingredient",
  "Cereal",
] as const;

export type ItemClassification = (typeof ITEM_CLASSIFICATIONS)[number];

export const UNITS_OF_MEASURE = ["kg", "gms", "bunch", "item"] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

export interface UnitAndPrice {
  unit: UnitOfMeasure;
  price: number;
}

export interface Ingredient {
  itemNumber: string; // User-facing "No." and unique ID
  itemDescription: string;
  itemClassification: ItemClassification;
  units: UnitAndPrice[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  quantityUsed?: number; // Ephemeral property for costing
  user_id?: string;
}

export interface RecipeIngredientItem {
  ingredientId: string; // References Ingredient.itemNumber
  quantity: number;
  unit: UnitOfMeasure;
}

export const RECIPE_TYPES = ["Breakfast", "Lunch/Dinner", "Evening Tea"] as const;
export type RecipeType = (typeof RECIPE_TYPES)[number];

export interface Recipe {
  recipeNumber: string; // User-facing unique ID
  recipeName: string; // "Food created"
  recipeType?: RecipeType;
  ingredients?: RecipeIngredientItem[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  user_id?: string;
}

export const MEAL_TYPES = [
    "Breakfast only", 
    "Lunch only", 
    "Dinner only", 
    "Breakfast and lunch", 
    "Brunch", 
    "Breakfast, lunch and evening tea", 
    "Breakfast, lunch and dinner", 
    "Evening tea"
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface ClientEvent {
  clientId: string; // References Client.id
  date: string; // ISO date string
  numberOfPeople: number;
  mealType: MealType;
  recipes: { recipeId: string }[]; // References Recipe.recipeNumber
  unitPrice: number;
  vatType: 'inclusive' | 'exclusive';
}

export interface Order {
  id: string; // User-facing unique ID
  name: string;
  description?: string;
  proformaId?: string;
  booking_id?: string;
  clientEvents: ClientEvent[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// Shared Invoice Item Type
export interface InvoiceItem {
  id: string;
  eventType: string;
  customEventType?: string;
  mealType: string;
  pax: number;
  unitPrice: number;
  total: number;
  date?: string; // ISO string
  particularType: 'event' | 'meal';
  particularDescription?: string;
  vatType: 'inclusive' | 'exclusive';
}

// Proforma Invoice Types
export interface ProformaInvoice {
  id: string; // The invoice number
  invoiceDate: string; // ISO string
  clientId: string | null;
  receiverName: string;
  receiverPosition: string;
  lpoNumber: string;
  location: string;
  numberOfDays: number;
  multiplyByDays: boolean;
  serviceCharge: number;
  transportCosts: number;
  vatType: 'inclusive' | 'exclusive';
  selectedEventType: string;
  customEventType?: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  serviceFields: Record<string, boolean>;
  serviceDesc: string;
  items: InvoiceItem[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  isInvoiced?: boolean; // New status flag
}


// Final Invoice Types
export interface Invoice {
  id: string; // The final invoice number
  proformaId?: string; // Optional link to the source proforma
  status: 'outstanding' | 'paid';
  invoiceDate: string; // ISO string
  clientId: string | null;
  receiverName: string;
  receiverPosition: string;
  lpoNumber: string;
  location: string;
  numberOfDays: number;
  multiplyByDays: boolean;
  serviceCharge: number;
  transportCosts: number;
  vatType: 'inclusive' | 'exclusive';
  selectedEventType: string;
  customEventType: string;
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  serviceFields: Record<string, boolean>;
  serviceDesc: string;
  items: InvoiceItem[];
  signedAtDate?: string; // ISO string
  signedAtLocation?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// Daily Costing Snapshot
export interface DailyCosting {
    date: string; // YYYY-MM-DD format
    totalIngredientCost: number;
    totalEventIncome: number;
    netProfitLoss: number;
    createdAt: string; // ISO string
}

// --- CONTINUOUS INVOICING / BOOKING ---
export interface Booking {
  id: string;
  client_id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed' | 'pending';
  created_at: string;
  updated_at: string;
}

// --- DELIVERY NOTE ---
export interface DeliveryNoteItem {
  qty: number;
  itemCode: string; // Recipe Number
  description: string; // Recipe Name
}

export interface DeliveryNote {
  id: string; // Delivery Note Number
  orderId: string;
  clientId: string;
  clientName: string;
  deliveryDate: string; // ISO date string
  deliveryLocation: string;
  vehicleRegNo?: string;
  deliveredBy: string;
  items: DeliveryNoteItem[];
  createdAt: string;
  updatedAt: string;
  user_id: string;
}

// --- HR & OPERATIONS ---

export interface Asset {
  id: string;
  name: string;
  type: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  status: string;
  lastMaintenance: string;
  nextMaintenance: string;
  createdAt: string;
  updatedAt: string;
}


// Issuance Types
export interface IssuedItem {
  assetId: string;
  name: string;
  type: string;
  unitPrice: number;
  quantityIssued: number;
  quantityReturned?: number;
}

export interface Issuance {
    id: string;
    orderId: string; // Link to a client order
    issuedTo: string; // Employee Name
    date: string; // ISO date string
    status: 'Issued' | 'Partially Returned' | 'Returned' | 'Incomplete';
    items: IssuedItem[];
    totalValue: number;
    notes?: string;
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
}


// HR Schemas
export const DEPARTMENTS = ["Kitchen", "Service", "Management", "Logistics", "Sales"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export interface Employee {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  nationalId?: string;
  tin?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  role: string;
  department: Department;
  status: 'Active' | 'Inactive';
  monthlySalary?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
    id: string;
    employee: string;
    date: string;
    clockIn: string;
    clockOut: string;
    totalHours: string;
    createdAt: string;
    updatedAt: string;
}

export interface Position {
    id: string;
    title: string;
    department: string;
    location: string;
    type: string;
    applicants: number;
    createdAt: string;
    updatedAt: string;
}

export interface Payroll {
    id: string;
    employeeId: string;
    employeeName: string;
    payPeriodStart: string;
    payPeriodEnd: string;
    basicSalary: number;
    allowances: number;
    deductions: number;
    grossSalary: number;
    netSalary: number;
    status: 'Paid' | 'Pending';
    paymentDate: string | null;
    createdAt: string;
    updatedAt: string;
}


// PRODUCT & STOCK
export interface Product {
    id: string;
    sku: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    minStock: number;
    maxStock: number;
    expiryDate: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface StockLog {
    id: string;
    productId: string;
    productName: string;
    type: 'Stock In' | 'Stock Out';
    quantity: number;
    price: number;
    actual_unit_price?: number;
    reason: string;
    date: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export interface DailyMenu {
    id: number;
    order_id: string;
    menu_date: string; // YYYY-MM-DD
    recipes: { recipeId: string }[];
    created_at: string;
    updated_at: string;
}
