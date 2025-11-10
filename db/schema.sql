
-- Drop existing tables if they exist to ensure a clean slate.
DROP TABLE IF EXISTS purchases, sales, stock_logs, costing_reports CASCADE;

-- Create the 'purchases' table
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

-- Enable RLS for 'purchases'
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Create Policies for 'purchases'
CREATE POLICY "Authenticated users can manage their own purchases" ON purchases
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create the 'sales' table
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

-- Enable RLS for 'sales'
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create Policies for 'sales'
CREATE POLICY "Authenticated users can manage their own sales" ON sales
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Create the 'stock_logs' table
CREATE TABLE IF NOT EXISTS stock_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    productId TEXT NOT NULL,
    productName TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Stock In', 'Stock Out')),
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    actual_unit_price NUMERIC,
    reason TEXT,
    date DATE NOT NULL,
    status TEXT,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Create the 'costing_reports' table
CREATE TABLE IF NOT EXISTS costing_reports (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, type, description)
);

-- Enable RLS for 'costing_reports'
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;

-- Create Policies for 'costing_reports'
CREATE POLICY "Users can manage their own costing reports" ON costing_reports
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- ACCOUNTS RECEIVABLE LEDGER
-- This is not a separate table. It's a VIEW or a query on the 'sales' table.
-- The logic is: SELECT * FROM sales WHERE paymentStatus = 'unpaid';
-- This gives you a real-time list of all outstanding balances from customers.

-- ACCOUNTS PAYABLE LEDGER
-- This is not a separate table. It's a VIEW or a query on the 'purchases' table.
-- The logic is: SELECT * FROM purchases WHERE paymentStatus = 'unpaid';
-- This gives you a real-time list of all amounts owed to suppliers.

-- Add user_id to existing tables if it's not there
ALTER TABLE IF EXISTS purchases ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Alter bookings table to add proforma_invoice_id
ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS proforma_invoice_id TEXT;
ALTER TABLE IF EXISTS bookings ADD CONSTRAINT bookings_proforma_invoice_id_unique UNIQUE (proforma_invoice_id);

-- Alter proforma_invoices table to add booking_id
ALTER TABLE IF EXISTS proforma_invoices ADD COLUMN IF NOT EXISTS booking_id TEXT;

-- Alter orders table to add booking_id
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS booking_id TEXT;
