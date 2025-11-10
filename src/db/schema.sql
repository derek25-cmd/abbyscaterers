
-- Purchases Table
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    supplier TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unitCost NUMERIC NOT NULL,
    totalCost NUMERIC NOT NULL,
    taxAmount NUMERIC DEFAULT 0,
    paymentMethod TEXT NOT NULL,
    paymentStatus TEXT NOT NULL,
    expenseCategory TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES auth.users(id) NOT NULL
);

-- Sales Table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    customerId TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unitPrice NUMERIC NOT NULL,
    totalAmount NUMERIC NOT NULL,
    taxAmount NUMERIC DEFAULT 0,
    paymentMethod TEXT NOT NULL,
    paymentStatus TEXT NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES auth.users(id) NOT NULL
);

-- Costing Reports Table
CREATE TABLE costing_reports (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL, -- 'income' or 'expense'
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, type, description)
);

-- Bookings Table
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL,
    proforma_invoice_id TEXT, -- Link to the generated proforma invoice
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Proforma Invoices Table (ensure booking_id is present)
-- If this table already exists, you may need to add the column with ALTER TABLE
CREATE TABLE proforma_invoices (
    -- ... other columns
    booking_id TEXT,
    -- ... other columns
);
-- If the table exists, run this:
-- ALTER TABLE proforma_invoices ADD COLUMN booking_id TEXT;


-- RLS Policies
-- Enable RLS for all relevant tables
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy for Purchases
CREATE POLICY "Users can manage their own purchases"
ON purchases FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for Sales
CREATE POLICY "Users can manage their own sales"
ON sales FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for Costing Reports
CREATE POLICY "Users can manage their own costing reports"
ON costing_reports FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for Bookings
CREATE POLICY "Users can manage their own bookings"
ON bookings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Note on Ledgers:
-- The Accounts Payable and Accounts Receivable Ledgers are not separate tables.
-- They are derived by querying the 'purchases' and 'sales' tables, respectively.
--
-- To get Accounts Payable (Creditors):
-- SELECT * FROM purchases WHERE paymentStatus = 'unpaid';
--
-- To get Accounts Receivable (Debtors):
-- SELECT * FROM sales WHERE paymentStatus = 'unpaid';
