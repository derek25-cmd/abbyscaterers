
-- Drop existing tables to ensure a clean slate
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS purchases;

-- Create the purchases table with snake_case column names
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

-- Create the sales table with snake_case column names
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    customerid TEXT NOT NULL,
    invoicenumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unitprice NUMERIC(10, 2) NOT NULL,
    totalamount NUMERIC(12, 2) NOT NULL,
    taxamount NUMERIC(10, 2) DEFAULT 0,
    paymentmethod TEXT CHECK (paymentmethod IN ('cash', 'bank', 'credit')),
    paymentstatus TEXT CHECK (paymentstatus IN ('paid', 'unpaid')),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    createdat TIMESTAMPTZ DEFAULT now(),
    updatedat TIMESTAMPTZ DEFAULT now()
);

-- Create the costing_reports table
CREATE TABLE IF NOT EXISTS costing_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, type, description)
);


-- ACCOUNTS PAYABLE & RECEIVABLE are not direct tables.
-- They are derived from 'purchases' and 'sales' tables respectively.

-- To get Accounts Payable (unpaid purchases):
-- SELECT * FROM purchases WHERE paymentstatus = 'unpaid';

-- To get Accounts Receivable (unpaid sales):
-- SELECT * FROM sales WHERE paymentstatus = 'unpaid';


-- Enable RLS for all tables
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before creating new ones to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can manage their own purchases" ON purchases;
DROP POLICY IF EXISTS "Authenticated users can manage their own sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can manage their own costing reports" ON costing_reports;

-- RLS Policies
CREATE POLICY "Authenticated users can manage their own purchases" ON purchases
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage their own sales" ON sales
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage their own costing reports" ON costing_reports
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Create foreign key relationships
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS proforma_invoice_id TEXT UNIQUE;

ALTER TABLE public.proforma_invoices
ADD COLUMN IF NOT EXISTS booking_id TEXT UNIQUE;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS booking_id TEXT;
