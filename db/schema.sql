-- This is the schema for the CaterSmart Client Manager app.
--
-- ** Clients Table **
-- Stores primary information about each client company.
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY, -- User-defined Customer Registration Number, e.g., "CUST-001"
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT,
    "phoneNumber" TEXT,
    address1 TEXT NOT NULL,
    address2 TEXT,
    "postalCode" TEXT,
    "primaryLocation" TEXT NOT NULL,
    "typeOfOrganization" TEXT,
    contacts JSONB, -- Array of { name, email, phone }
    "lastContacted" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage clients" ON clients FOR ALL TO authenticated USING (true);


-- ** Equipment Table **
-- Stores information about catering equipment.
CREATE TABLE IF NOT EXISTS equipment (
    "equipmentNumber" TEXT PRIMARY KEY,
    "equipmentName" TEXT NOT NULL,
    oem TEXT,
    model TEXT,
    "powerRating" TEXT,
    quantity INTEGER NOT NULL,
    "yearOfManufacture" TEXT,
    "equipmentSource" TEXT,
    capacity TEXT,
    commitment TEXT,
    "registrationNumber" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage equipment" ON equipment FOR ALL TO authenticated USING (true);


-- ** Ingredients Table **
-- Stores information about ingredients for recipes.
CREATE TABLE IF NOT EXISTS ingredients (
    "itemNumber" TEXT PRIMARY KEY,
    "itemDescription" TEXT NOT NULL,
    "itemClassification" TEXT,
    units JSONB, -- Array of { unit, price }
    "quantityUsed" NUMERIC(10, 2) DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage ingredients" ON ingredients FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ** Recipes Table **
-- Stores recipe information.
CREATE TABLE IF NOT EXISTS recipes (
    "recipeNumber" TEXT PRIMARY KEY,
    "recipeName" TEXT NOT NULL,
    "recipeType" TEXT,
    ingredients JSONB, -- Array of { ingredientId, quantity, unit }
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage recipes" ON recipes FOR ALL TO authenticated USING (auth.uid() = user_id);


-- ** Orders Table **
-- A flexible table to store single or multi-event orders.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "proformaId" TEXT,
  "clientEvents" JSONB, -- Array of ClientEvent objects
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage orders" ON orders FOR ALL TO authenticated USING (true);


-- ** Bookings Table (for continuous contracts) **
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  proforma_invoice_id TEXT UNIQUE
);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage bookings" ON bookings FOR ALL TO authenticated USING (auth.uid() = user_id);


-- ** Proforma Invoices Table **
CREATE TABLE IF NOT EXISTS proforma_invoices (
  id TEXT PRIMARY KEY,
  "invoiceDate" TIMESTAMPTZ NOT NULL,
  "clientId" TEXT REFERENCES clients(id),
  "receiverName" TEXT,
  "receiverPosition" TEXT,
  "lpoNumber" TEXT,
  location TEXT,
  "numberOfDays" INTEGER,
  "multiplyByDays" BOOLEAN,
  "serviceCharge" NUMERIC,
  "transportCosts" NUMERIC,
  "vatType" TEXT,
  "selectedEventType" TEXT,
  "customEventType" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "serviceFields" JSONB,
  "serviceDesc" TEXT,
  items JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now(),
  "isInvoiced" BOOLEAN DEFAULT false,
   booking_id TEXT UNIQUE REFERENCES bookings(id) ON DELETE SET NULL
);
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage proforma invoices" ON proforma_invoices FOR ALL TO authenticated USING (true);


-- ** Final Invoices Table **
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  "proformaId" TEXT,
  status TEXT NOT NULL,
  "invoiceDate" TIMESTAMPTZ NOT NULL,
  "clientId" TEXT REFERENCES clients(id),
  "receiverName" TEXT,
  "receiverPosition" TEXT,
  "lpoNumber" TEXT,
  location TEXT,
  "numberOfDays" INTEGER,
  "multiplyByDays" BOOLEAN,
  "serviceCharge" NUMERIC,
  "transportCosts" NUMERIC,
  "vatType" TEXT,
  "selectedEventType" TEXT,
  "customEventType" TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "serviceFields" JSONB,
  "serviceDesc" TEXT,
  items JSONB,
  "signedAtDate" TIMESTAMPTZ,
  "signedAtLocation" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage final invoices" ON invoices FOR ALL TO authenticated USING (true);

-- Add booking_id to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL;


-- HR & Operations Tables
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT,
    unit TEXT,
    "unitPrice" NUMERIC(10, 2),
    quantity NUMERIC(10, 2),
    status TEXT,
    branch TEXT,
    "lastMaintenance" DATE,
    "nextMaintenance" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage assets" ON assets FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS issuance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" TEXT NOT NULL,
    "issuedTo" TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT,
    branch TEXT,
    items JSONB,
    "totalValue" NUMERIC(12, 2),
    notes TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE issuance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage issuances" ON issuance FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    dob DATE,
    gender TEXT,
    nationality TEXT,
    "nationalId" TEXT,
    tin TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactRelationship" TEXT,
    "emergencyContactPhone" TEXT,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL,
    "monthlySalary" NUMERIC(10, 2),
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage employees" ON employees FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee TEXT NOT NULL,
    date DATE NOT NULL,
    "clockIn" TIME,
    "clockOut" TIME,
    "totalHours" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage attendance" ON attendance FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    type TEXT,
    applicants INTEGER,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage positions" ON positions FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "employeeId" UUID,
    "employeeName" TEXT,
    "payPeriodStart" DATE,
    "payPeriodEnd" DATE,
    "basicSalary" NUMERIC(12, 2),
    allowances NUMERIC(12, 2),
    deductions NUMERIC(12, 2),
    "grossSalary" NUMERIC(12, 2),
    "netSalary" NUMERIC(12, 2),
    status TEXT,
    "paymentDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage payroll" ON payroll FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT,
    name TEXT NOT NULL,
    category TEXT,
    quantity NUMERIC(10, 2),
    unit TEXT,
    "unitPrice" NUMERIC(10, 2),
    "minStock" NUMERIC(10, 2),
    "maxStock" INTEGER,
    "expiryDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage products" ON products FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS stock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID,
    "productName" TEXT,
    type TEXT,
    quantity NUMERIC(10, 2),
    price NUMERIC(12, 2),
    actual_unit_price NUMERIC(10, 2),
    reason TEXT,
    date DATE,
    status TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage stock logs" ON stock_logs FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS daily_menus (
    id BIGSERIAL PRIMARY KEY,
    order_id TEXT NOT NULL,
    menu_date DATE NOT NULL,
    recipes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id, menu_date)
);
ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage daily menus" ON daily_menus FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    supplier TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unitCost NUMERIC(10, 2) NOT NULL,
    totalCost NUMERIC(12, 2) NOT NULL,
    taxAmount NUMERIC(10, 2) DEFAULT 0,
    paymentMethod TEXT CHECK (paymentMethod IN ('cash', 'bank', 'credit')),
    paymentStatus TEXT CHECK (paymentStatus IN ('paid', 'unpaid')),
    expenseCategory TEXT,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Policies for purchases
CREATE POLICY "Authenticated users can manage their own purchases" ON purchases
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    customerId TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unitPrice NUMERIC(10, 2) NOT NULL,
    totalAmount NUMERIC(12, 2) NOT NULL,
    taxAmount NUMERIC(10, 2) DEFAULT 0,
    paymentMethod TEXT CHECK (paymentMethod IN ('cash', 'bank', 'credit')),
    paymentStatus TEXT CHECK (paymentStatus IN ('paid', 'unpaid')),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage sales" ON sales FOR ALL TO authenticated USING (true);


CREATE TABLE IF NOT EXISTS costing_reports (
    id BIGSERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, type, description)
);
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage costing reports" ON costing_reports FOR ALL TO authenticated USING (true);

-- Convert integer columns to numeric to support decimals
ALTER TABLE products ALTER COLUMN "unitPrice" TYPE numeric(10, 2);
ALTER TABLE products ALTER COLUMN "minStock" TYPE numeric(10, 2);
ALTER TABLE stock_logs ALTER COLUMN price TYPE numeric(12, 2);
ALTER TABLE stock_logs ALTER COLUMN actual_unit_price TYPE numeric(10, 2);
