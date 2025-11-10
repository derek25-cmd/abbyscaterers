-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';


-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    companyName TEXT NOT NULL,
    companyEmail TEXT,
    phoneNumber TEXT,
    address1 TEXT NOT NULL,
    address2 TEXT,
    postalCode TEXT,
    primaryLocation TEXT NOT NULL,
    typeOfOrganization TEXT NOT NULL,
    contacts JSONB,
    lastContacted DATE,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Trigger for clients table
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for clients and define policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view clients" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clients" ON clients FOR DELETE TO authenticated USING (true);


-- Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    "recipeNumber" TEXT PRIMARY KEY,
    "recipeName" TEXT NOT NULL,
    "recipeType" TEXT,
    ingredients JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

-- Trigger for recipes table
CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON recipes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for recipes and define policies
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own recipes" ON recipes FOR ALL TO authenticated USING (auth.uid() = user_id);


-- Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
    "itemNumber" TEXT PRIMARY KEY,
    "itemDescription" TEXT NOT NULL,
    "itemClassification" TEXT,
    units JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "quantityUsed" NUMERIC,
    user_id UUID REFERENCES auth.users(id)
);

-- Trigger for ingredients table
CREATE TRIGGER update_ingredients_updated_at
BEFORE UPDATE ON ingredients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for ingredients and define policies
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own ingredients" ON ingredients FOR ALL TO authenticated USING (auth.uid() = user_id);


-- Proforma Invoices Table
CREATE TABLE IF NOT EXISTS proforma_invoices (
    id TEXT PRIMARY KEY,
    "invoiceDate" DATE,
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
    "startDate" DATE,
    "endDate" DATE,
    "serviceFields" JSONB,
    "serviceDesc" TEXT,
    items JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "isInvoiced" BOOLEAN DEFAULT false,
    booking_id TEXT
);
-- Add foreign key constraint to link to bookings table
ALTER TABLE proforma_invoices
ADD CONSTRAINT fk_booking
FOREIGN KEY (booking_id)
REFERENCES bookings(id);


-- Trigger for proforma_invoices table
CREATE TRIGGER update_proforma_invoices_updated_at
BEFORE UPDATE ON proforma_invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS for proforma_invoices
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage proforma invoices" ON proforma_invoices FOR ALL TO authenticated USING (true);

-- Final Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    "proformaId" TEXT,
    status TEXT,
    "invoiceDate" DATE,
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
    "startDate" DATE,
    "endDate" DATE,
    "serviceFields" JSONB,
    "serviceDesc" TEXT,
    items JSONB,
    "signedAtDate" DATE,
    "signedAtLocation" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Trigger for invoices table
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage invoices" ON invoices FOR ALL TO authenticated USING (true);


-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT 'ORD-' || substr(gen_random_uuid()::text, 1, 8),
  name TEXT NOT NULL,
  description TEXT,
  "proformaId" TEXT,
  "clientEvents" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now(),
  booking_id TEXT
);
-- Add foreign key constraint to link to bookings table
ALTER TABLE orders
ADD CONSTRAINT fk_booking
FOREIGN KEY (booking_id)
REFERENCES bookings(id);


-- Trigger for orders table
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage orders" ON orders FOR ALL TO authenticated USING (true);


-- Bookings (Continuous Invoicing) Table
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    proforma_invoice_id TEXT
);

-- Add a unique constraint to the proforma_invoice_id column
ALTER TABLE bookings
ADD CONSTRAINT unique_proforma_invoice_id
UNIQUE (proforma_invoice_id);

-- Add foreign key constraint to clients table
ALTER TABLE bookings
ADD CONSTRAINT fk_client
FOREIGN KEY (client_id)
REFERENCES clients(id);

-- Add foreign key constraint to auth.users table
ALTER TABLE bookings
ADD CONSTRAINT fk_user
FOREIGN KEY (user_id)
REFERENCES auth.users(id);


-- Delivery Notes Table
CREATE TABLE IF NOT EXISTS delivery_notes (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT,
    delivery_date DATE NOT NULL,
    delivery_location TEXT NOT NULL,
    vehicle_reg_no TEXT,
    delivered_by TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    items JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for delivery notes
CREATE TRIGGER update_delivery_notes_updated_at
BEFORE UPDATE ON delivery_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS for delivery notes
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage delivery notes" ON delivery_notes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Daily Menus Table
CREATE TABLE IF NOT EXISTS daily_menus (
    id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL,
    menu_date DATE NOT NULL,
    recipes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id, menu_date)
);

ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage daily menus" ON daily_menus FOR ALL TO authenticated USING (true);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT 'PROD' || substr(gen_random_uuid()::text, 1, 8),
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    quantity NUMERIC(10, 2),
    unit TEXT,
    unitPrice NUMERIC(10, 2),
    minStock NUMERIC(10, 2),
    maxStock INTEGER,
    expiryDate DATE,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- RLS for products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage products" ON products FOR ALL TO authenticated USING (true);

-- Stock Logs table
CREATE TABLE IF NOT EXISTS stock_logs (
    id TEXT PRIMARY KEY DEFAULT 'LOG' || substr(gen_random_uuid()::text, 1, 8),
    productId TEXT,
    productName TEXT,
    type TEXT,
    quantity NUMERIC(10, 2),
    price NUMERIC(10, 2),
    actual_unit_price NUMERIC(10, 2),
    reason TEXT,
    date DATE,
    status TEXT,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- RLS for stock_logs table
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage stock logs" ON stock_logs FOR ALL TO authenticated USING (true);

-- Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    supplier TEXT NOT NULL,
    invoicenumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unitcost NUMERIC(10, 2) NOT NULL,
    totalcost NUMERIC(12, 2) NOT NULL,
    taxamount NUMERIC(10, 2) DEFAULT 0,
    paymentmethod TEXT CHECK (paymentmethod IN ('cash', 'bank', 'credit')),
    paymentstatus TEXT CHECK (paymentstatus IN ('paid', 'unpaid')),
    expensecategory TEXT,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    createdat TIMESTAMPTZ DEFAULT now(),
    updatedat TIMESTAMPTZ DEFAULT now()
);

-- RLS for purchases table
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
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

-- RLS for sales table
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage sales" ON sales FOR ALL TO authenticated USING (true);


-- Costing Reports Table
CREATE TABLE IF NOT EXISTS costing_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, type, description)
);
-- RLS for costing_reports table
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage costing reports" ON costing_reports FOR ALL TO authenticated USING (true);

