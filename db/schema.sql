
-- ### Purchases Table ###
-- This table stores records of all goods and services bought.
-- It's the primary source for the "Purchases Book".
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


-- ### Sales Table ###
-- This table records all revenue-generating activities.
-- It's the primary source for the "Sales Book".
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

-- ### Costing Reports Table ###
-- Stores miscellaneous income and expenses for costing reports.
CREATE TABLE IF NOT EXISTS costing_reports (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, type, description)
);

-- Enable RLS
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;

-- Policies for costing_reports
CREATE POLICY "Authenticated users can manage their own costing reports" ON costing_reports
FOR ALL
TO authenticated
USING (auth.uid() = user_id);


-- ### SQL LOGIC TO ALTER TABLES FOR BOOKING-PROFORMA INTEGRATION ###

-- Add a column to the 'bookings' table to store the ID of the generated proforma invoice.
-- A UNIQUE constraint is added to enforce a one-to-one relationship.
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS proforma_invoice_id TEXT,
ADD CONSTRAINT bookings_proforma_invoice_id_unique UNIQUE (proforma_invoice_id);

-- Add a column to the 'proforma_invoices' table to link back to the booking.
ALTER TABLE public.proforma_invoices
ADD COLUMN IF NOT EXISTS booking_id TEXT;

-- Add a foreign key constraint to link bookings and proforma invoices.
-- This ensures data integrity.
ALTER TABLE public.bookings
ADD CONSTRAINT fk_proforma_invoice
FOREIGN KEY (proforma_invoice_id)
REFERENCES public.proforma_invoices(id)
ON DELETE SET NULL;

-- Add a foreign key constraint from proforma_invoices to bookings.
ALTER TABLE public.proforma_invoices
ADD CONSTRAINT fk_booking
FOREIGN KEY (booking_id)
REFERENCES public.bookings(id)
ON DELETE SET NULL;

-- Add a 'booking_id' column to the 'orders' table to link daily orders to a booking.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS booking_id TEXT;

-- Add a foreign key constraint from orders to bookings.
ALTER TABLE public.orders
ADD CONSTRAINT fk_booking
FOREIGN KEY (booking_id)
REFERENCES public.bookings(id)
ON DELETE CASCADE;


-- Note on Ledgers:
-- Accounts Receivable and Accounts Payable are not separate tables.
-- They are "views" derived from the sales and purchases tables.

-- To get Accounts Receivable (customers who owe money):
-- SELECT * FROM sales WHERE paymentStatus = 'unpaid';

-- To get Accounts Payable (money owed to suppliers):
-- SELECT * FROM purchases WHERE paymentStatus = 'unpaid';
