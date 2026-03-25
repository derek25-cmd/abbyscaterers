export const ORGANIZATION_TYPES = [
  "Industrial", "Commercial", "Financial", "Service", "Agricultural",
  "Educational", "Medical", "Technological", "Entertainment and Media",
  "Legal", "Military", "Governmental", "Religious", "NGO", "Public Health"
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const REGIONS = ["Dar es Salaam", "Arusha", "Dodoma", "Morogoro", "Mwanza", "Mbeya", "Pwani"] as const;
export type Region = (typeof REGIONS)[number];

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
export type MealType = string;

export interface ClientEvent {
  clientId?: string; // Populated from parent order when flattening events
  date: string; // ISO date string
  numberOfPeople: number;
  mealType: MealType;
  recipes: { recipeId: string }[]; // References Recipe.recipeNumber
  unitPrice: number;
  vatType: 'inclusive' | 'exclusive';
  region?: Region;
  particularType?: 'event' | 'meal' | 'custom';
  particularDescription?: string;
  eventType?: string;
  customEventType?: string;
}

export interface Order {
  id: string; // User-facing unique ID
  name: string;
  clientId: string; // Added to top level
  startDate: string; // Added to top level
  endDate: string; // Added to top level
  description?: string;
  proformaId?: string;
  booking_id?: string | null;
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
  particularType: 'event' | 'meal' | 'custom';
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
  region?: Region;
  numberOfDays: number;
  multiplyByDays: boolean;
  serviceCharge: number;
  transportCosts: number;
  vatType: 'inclusive' | 'exclusive';
  selectedEventType: string;
  customEventType: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  serviceFields: Record<string, boolean>;
  serviceDesc: string;
  items: InvoiceItem[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  isInvoiced?: boolean; // New status flag
  booking_id?: string | null;
}


// Final Invoice Types
export interface Invoice {
  id: string; // The final invoice number
  proformaId?: string; // Optional link to the source proforma
  status: 'outstanding' | 'paid';
  invoiceDate: string; // ISO string
  paymentDate?: string | null; // ISO string
  clientId: string | null;
  receiverName: string;
  receiverPosition: string;
  lpoNumber: string;
  location: string;
  region?: Region;
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
  appendProformaId?: boolean;
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
  proforma_invoice_id?: string | null;
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
  id: string; // Delivery Note Number (e.g., DN-0001)
  order_id: string;
  client_id: string;
  client_name: string;
  delivery_date: string; // ISO date string
  delivery_location: string;
  vehicle_reg_no?: string;
  delivered_by: string;
  items: DeliveryNoteItem[];
  created_at: string;
  updated_at: string;
  user_id: string;
}


// HR & OPERATIONS

export const BRANCHES = ["Dar es Salaam", "Dodoma", "Arusha"] as const;
export type Branch = typeof BRANCHES[number];

export interface Asset {
  id: string;
  name: string;
  type: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  status: string;
  branch: Branch;
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
    branch: Branch;
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
    actual_unit_price: number;
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
    region?: Region;
}

// --- FINANCE MODULE ---
export interface Purchase {
    id: string;
    date: string; // ISO date string
    supplier: string;
    invoiceNumber: string;
    description: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    taxAmount: number;
    paymentMethod: 'cash' | 'bank' | 'credit';
    paymentStatus: 'paid' | 'unpaid';
    expenseCategory: string;
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
    user_id: string;
}

export interface Sale {
    id: string;
    date: string; // ISO date string
    customerId: string;
    invoiceNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    taxAmount: number;
    paymentMethod: 'cash' | 'bank' | 'credit';
    paymentStatus: 'paid' | 'unpaid';
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
}

export interface CostingReportItem {
    id: number;
    report_date: string;
    type: 'income' | 'expense';
    description: string;
    amount: number;
    created_at: string;
}

// --- SUPERVISOR REPORT ---
export type ReportRating = 'Poor' | 'Fair' | 'Good' | 'Very Good' | 'Excellent';

export interface ReportCriterion {
    description: string;
    rating: ReportRating | null;
    isIssue: boolean;
    reason?: string;
}

export interface SupervisorReport {
    id: string;
    report_date: string; // ISO date string
    supervisor_id: string;
    supervisor_name: string;
    status: 'Draft' | 'Submitted';
    criteria: ReportCriterion[];
    general_comments?: string;
    prepared_by: string;
    checked_by?: string;
    signature?: string;
    created_at: string;
    updated_at: string;
}
