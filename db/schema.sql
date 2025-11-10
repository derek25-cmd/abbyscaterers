-- Purchases Table
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

-- Sales Table
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
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Policies for sales
CREATE POLICY "Authenticated users can manage their own sales" ON sales
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Costing Reports Table
CREATE TABLE IF NOT EXISTS costing_reports (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, type, description)
);

-- Enable RLS for costing_reports
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;

-- Policies for costing_reports
CREATE POLICY "Authenticated users can manage their own costing reports" ON costing_reports
FOR ALL
TO authenticated
USING (auth.uid() = user_id);


-- Accounts Payable and Receivable are not separate tables.
-- They are derived from the 'purchases' and 'sales' tables respectively.
-- Accounts Payable can be calculated by:
-- SELECT * FROM purchases WHERE paymentStatus = 'unpaid';
--
-- Accounts Receivable can be calculated by:
-- SELECT * FROM sales WHERE paymentStatus = 'unpaid';

-- Proforma Invoices Table
CREATE TABLE IF NOT EXISTS proforma_invoices (
    id TEXT PRIMARY KEY,
    "invoiceDate" TEXT,
    "clientId" TEXT,
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
    "startDate" TEXT,
    "endDate" TEXT,
    "serviceFields" JSONB,
    "serviceDesc" TEXT,
    items JSONB,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    "isInvoiced" BOOLEAN DEFAULT false,
    booking_id TEXT UNIQUE REFERENCES bookings(id)
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    "proformaId" TEXT,
    status TEXT,
    "invoiceDate" TEXT,
    "clientId" TEXT,
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
    "startDate" TEXT,
    "endDate" TEXT,
    "serviceFields" JSONB,
    "serviceDesc" TEXT,
    items JSONB,
    "signedAtDate" TEXT,
    "signedAtLocation" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    "companyName" TEXT,
    "companyEmail" TEXT,
    "phoneNumber" TEXT,
    address1 TEXT,
    address2 TEXT,
    "postalCode" TEXT,
    "primaryLocation" TEXT,
    "typeOfOrganization" TEXT,
    contacts JSONB,
    "lastContacted" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    description TEXT,
    "proformaId" TEXT,
    "clientEvents" JSONB,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL
);

-- Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "recipeNumber" TEXT UNIQUE,
    "recipeName" TEXT,
    "recipeType" TEXT,
    ingredients JSONB,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    user_id UUID REFERENCES auth.users(id)
);

-- Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "itemNumber" TEXT UNIQUE,
    "itemDescription" TEXT,
    "itemClassification" TEXT,
    units JSONB,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    user_id UUID REFERENCES auth.users(id)
);

-- Delivery Notes Table
CREATE TABLE IF NOT EXISTS delivery_notes (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    client_id TEXT,
    client_name TEXT,
    delivery_date TEXT,
    delivery_location TEXT,
    vehicle_reg_no TEXT,
    delivered_by TEXT,
    items JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);


-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    name TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT,
    proforma_invoice_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Daily Menus Table
CREATE TABLE IF NOT EXISTS daily_menus (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id UUID NOT NULL,
    menu_date DATE NOT NULL,
    recipes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id, menu_date)
);

-- HR & Operations Tables

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
    status TEXT NOT NULL DEFAULT 'Active',
    "monthlySalary" NUMERIC(12, 2),
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee TEXT NOT NULL,
    date DATE NOT NULL,
    "clockIn" TEXT,
    "clockOut" TEXT,
    "totalHours" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL,
    applicants INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "payPeriodStart" DATE NOT NULL,
    "payPeriodEnd" DATE NOT NULL,
    "basicSalary" NUMERIC(12, 2) NOT NULL,
    allowances NUMERIC(12, 2) DEFAULT 0,
    deductions NUMERIC(12, 2) DEFAULT 0,
    "grossSalary" NUMERIC(12, 2) NOT NULL,
    "netSalary" NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    "paymentDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    unit TEXT NOT NULL,
    "unitPrice" NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'Dar es Salaam',
    "lastMaintenance" DATE,
    "nextMaintenance" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issuance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" TEXT NOT NULL,
    "issuedTo" TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    branch TEXT NOT NULL,
    items JSONB NOT NULL,
    "totalValue" NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL,
    "unitPrice" NUMERIC(12, 2) NOT NULL,
    "minStock" INTEGER DEFAULT 0,
    "maxStock" INTEGER DEFAULT 100,
    "expiryDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID REFERENCES products(id),
    "productName" TEXT,
    type TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    price NUMERIC(12, 2),
    actual_unit_price NUMERIC(12, 2),
    reason TEXT,
    date DATE NOT NULL,
    status TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
