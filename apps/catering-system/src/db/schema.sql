
-- Client Table
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY, -- Customer Registration Number
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT,
    "phoneNumber" TEXT,
    address1 TEXT NOT NULL,
    address2 TEXT,
    "postalCode" TEXT,
    "primaryLocation" TEXT NOT NULL,
    "typeOfOrganization" TEXT,
    contacts JSONB,
    "lastContacted" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Policies for clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage clients" ON clients
FOR ALL
TO authenticated
USING (true);


-- Equipment Table
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

-- Policies for equipment
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage equipment" ON equipment
FOR ALL
TO authenticated
USING (true);

-- Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
    "itemNumber" TEXT PRIMARY KEY,
    "itemDescription" TEXT NOT NULL,
    "itemClassification" TEXT,
    units JSONB,
    "quantityUsed" NUMERIC(10, 2) DEFAULT 0,
    "user_id" UUID REFERENCES auth.users(id) NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Policies for ingredients
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage ingredients" ON ingredients
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    "recipeNumber" TEXT PRIMARY KEY,
    "recipeName" TEXT NOT NULL,
    "recipeType" TEXT,
    ingredients JSONB,
    "user_id" UUID REFERENCES auth.users(id) NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Policies for recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage recipes" ON recipes
FOR ALL
TO authenticated
USING (auth.uid() = user_id);


-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    "proformaId" TEXT,
    "clientEvents" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS booking_id TEXT;


-- Policies for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage orders" ON orders
FOR ALL
TO authenticated
USING (true);


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
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "isInvoiced" BOOLEAN DEFAULT false
);

ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS booking_id TEXT;


-- Policies for proforma_invoices
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage proforma_invoices" ON proforma_invoices
FOR ALL
TO authenticated
USING (true);

-- Final Invoices Table
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
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Policies for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoices" ON invoices
FOR ALL
TO authenticated
USING (true);


-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proforma_invoice_id TEXT UNIQUE;


-- Policies for bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their own bookings" ON bookings
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Enable read access for all authenticated users" ON bookings
FOR SELECT
TO authenticated
USING (true);


-- Delivery Notes Table
CREATE TABLE IF NOT EXISTS delivery_notes (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    delivery_date TEXT NOT NULL,
    delivery_location TEXT NOT NULL,
    vehicle_reg_no TEXT,
    delivered_by TEXT NOT NULL,
    items JSONB,
    event_id TEXT,
    is_narration BOOLEAN DEFAULT FALSE,
    narration_text TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Policies for delivery notes
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage delivery notes" ON delivery_notes
FOR ALL
TO authenticated
USING (true);


-- Daily Menus Table
CREATE TABLE IF NOT EXISTS daily_menus (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id TEXT NOT NULL,
    menu_date DATE NOT NULL,
    recipes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id, menu_date)
);

ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage daily menus" ON daily_menus
FOR ALL
TO authenticated
USING (true);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT,
    "unitPrice" NUMERIC(10, 2) NOT NULL,
    "minStock" INTEGER,
    "maxStock" INTEGER,
    "expiryDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Policies for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage products" ON products
FOR ALL
TO authenticated
USING (true);

-- Stock Logs Table
CREATE TABLE IF NOT EXISTS stock_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "productId" UUID REFERENCES products(id),
    "productName" TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    reason TEXT,
    date DATE NOT NULL,
    status TEXT,
    actual_unit_price NUMERIC(10, 2),
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Policies for stock logs
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage stock_logs" ON stock_logs
FOR ALL
TO authenticated
USING (true);


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
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage sales" ON sales
FOR ALL
TO authenticated
USING (true);


-- Costing Reports Table
CREATE TABLE IF NOT EXISTS costing_reports (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, type, description)
);

ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage costing reports" ON costing_reports
FOR ALL
TO authenticated
USING (true);
