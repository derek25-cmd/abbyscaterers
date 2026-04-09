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

export const RECIPE_TYPES = ["Breakfast", "Lunch", "Dinner", "Brunch", "Evening Tea", "Cocktail"] as const;
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
  id: string; // Unique Event ID (EVT-XXXXX)
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
  id: string; // Event ID (EVT-XXXXX)
  orderId?: string; // Parent Order ID (ORD-XXXXX) for linking
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
  status: 'outstanding' | 'paid' | 'partially paid';
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
  amountPaid?: number; // Accumulated amount paid
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

// --- CUSTOMER FEEDBACK ---
export interface ServiceFeedback {
  id: string; // UUID
  report_date: string; // DATE
  order_id?: string | null; // TEXT (ORD-XXXXX)
  overall_summary: string;
  positive_feedback: string;
  complaints: string;
  waiter_challenges: string;
  created_at?: string;
  updated_at?: string;
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
  event_id?: string;
  is_narration?: boolean;
  narration_text?: string;
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

export type AttendanceStatus = 'Present' | 'Absent' | 'Leave' | 'Half Day' | 'Late';

export interface Attendance {
    id: string;
    employee_id: string;
    employee: string; // Maintain for backwards compatibility with legacy UI
    date: string;
    status: AttendanceStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TrainingSession {
    id: string;
    title: string;
    department: string;
    location: string;
    type: string;
    applicants: number;
    training_date?: string;
    description?: string;
    trainer_name?: string;
    duration_days?: number;
    module_code?: string;
    learning_objectives?: string[];
    assessment_method?: string;
    resource_requirements?: string;
    target_audience?: string;
    expected_outcomes?: string;
    custom_skills?: string[];
    session_status?: 'Upcoming' | 'In Progress' | 'Completed';
    createdAt: string;
    updatedAt: string;
}

export interface TrainingParticipant {
    id: string;
    training_id: string;
    employee_id: string;
    status: 'Enrolled' | 'In Progress' | 'Completed' | 'Failed';
    grade?: string;
    notes?: string;
    employee_name?: string; // Virtual property for UI
    created_at: string;
    updated_at: string;
}

export const DEFAULT_TRAINING_SKILLS = [
    'Punctuality',
    'Attentiveness',
    'Practical Skills',
    'Theory Knowledge',
    'Teamwork'
] as const;

export interface TrainingEvaluation {
    id: string;
    participant_id: string;
    training_id: string;
    evaluation_date: string;
    score: number; // 1-5
    skills_demonstrated: string[];
    notes: string;
    evaluator_name: string;
    created_at: string;
    updated_at?: string;
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
    quantity: number;          // Legacy aggregate (kept for compat)
    unit: string;
    unitPrice: number;         // Legacy aggregate (kept for compat)
    minStock: number;
    maxStock: number;
    expiryDate: string | null;
    // Per-branch quantities
    quantity_dar: number;
    quantity_arusha: number;
    quantity_dodoma: number;
    // Per-branch unit prices
    unitPrice_dar: number;
    unitPrice_arusha: number;
    unitPrice_dodoma: number;
    createdAt: string;
    updatedAt: string;
}

export const BRANCH_KEYS: Record<Branch, { qty: keyof Product; price: keyof Product }> = {
    'Dar es Salaam': { qty: 'quantity_dar', price: 'unitPrice_dar' },
    'Arusha': { qty: 'quantity_arusha', price: 'unitPrice_arusha' },
    'Dodoma': { qty: 'quantity_dodoma', price: 'unitPrice_dodoma' },
};

export interface StockLog {
    id: string;
    productId: string;
    productName: string;
    type: 'Stock In' | 'Stock Out';
    quantity: number;
    actual_quantity?: number;
    price: number;
    actual_unit_price: number;
    reason: string;
    date: string;
    status: string;
    branch: Branch;
    createdAt: string;
    updatedAt: string;
}

export interface DailyMenu {
    id: number;
    order_id: string; // References Order.id
    event_id: string; // References ClientEvent.id
    menu_date: string; // YYYY-MM-DD
    recipes: { rowIndex: number; recipeId?: string; name: string }[];
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
    branch: Branch;
    created_at: string;
}

// --- MENU COSTING ---
export interface MenuType {
    id: string;
    name: string;
}

export const MENU_TYPE_NAMES = ['breakfast', 'brunch', 'lunch', 'dinner'] as const;
export type MenuTypeName = (typeof MENU_TYPE_NAMES)[number];

export interface CateringMenu {
    id: string;
    name: string;
    menu_type_id: string;
    menu_type_name?: string;
    base_people: number;
    price_per_person: number;
    notes?: string;
    created_at: string;
    updated_at: string;
    user_id?: string;
}

export interface CateringMenuRecipe {
    id: string;
    menu_id: string;
    recipe_number: string;
    recipe_name?: string;
    recipe_type?: string;
    created_at: string;
}

export interface IngredientSummaryItem {
    ingredient: string;
    totalQuantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
}

export interface PlannedIngredient {
    id: string;
    menu_id: string;
    ingredient_name: string;
    category: 'ingredient' | 'miscellaneous';
    planned_quantity: number;
    unit: string;
    unit_cost: number;
    created_at: string;
    updated_at: string;
}

export interface MenuCalculationResult {
    ingredientsSummary: IngredientSummaryItem[];
    totalCost: number; // Estimate Cost (Recipes)
    plannedTotalCost: number; // Planned Cost (User Input)
    revenue: number;   // Set Price
    profit: number;    // Revenue - Estimate Cost
    plannedProfit: number; // Revenue - Planned Cost
    margin: number;    // Margin based on Estimate Cost
    plannedMargin: number; // Margin based on Planned Cost
    efficiencyFactor: number; // Dynamic scaling multiplier (1.0 = neutral)
    efficiencyStatus: string; // e.g., "Bulk Efficiency" or "Small Group Inefficiency"
    plannedComparison?: PlannedVsCalculated[];
}

export interface PlannedVsCalculated {
    ingredient: string;
    category: 'ingredient' | 'miscellaneous';
    unit: string;
    plannedQty: number;
    calculatedQty: number;
    difference: number;       // calculated - planned (positive = need more, negative = excess)
    plannedCost: number;
    calculatedCost: number;
    costDifference: number;
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
