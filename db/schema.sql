-- Supabase SQL schema for the catering management system's finance module

-- ========== Purchases Table ==========
-- Purpose: Records all goods and services bought by the company.

CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    supplier TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unitCost NUMERIC NOT NULL,
    totalCost NUMERIC NOT NULL,
    taxAmount NUMERIC DEFAULT 0,
    paymentMethod TEXT CHECK (paymentMethod IN ('cash', 'bank', 'credit')),
    paymentStatus TEXT CHECK (paymentStatus IN ('paid', 'unpaid')),
    expenseCategory TEXT,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for the purchases table
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can manage their own purchase records
CREATE POLICY "Allow authenticated users to manage their own purchases"
ON public.purchases
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- ========== Sales Table ==========
-- Purpose: Records all revenue-generating activities.

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    customerId TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unitPrice NUMERIC NOT NULL,
    totalAmount NUMERIC NOT NULL,
    taxAmount NUMERIC DEFAULT 0,
    paymentMethod TEXT CHECK (paymentMethod IN ('cash', 'bank', 'credit')),
    paymentStatus TEXT CHECK (paymentStatus IN ('paid', 'unpaid')),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for the sales table
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can manage their own sales records
CREATE POLICY "Allow authenticated users to manage their own sales"
ON public.sales
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- ========== Costing Reports Table ==========
-- Purpose: Persists daily miscellaneous income and expenses for costing analysis.

CREATE TABLE IF NOT EXISTS public.costing_reports (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL UNIQUE,
    misc_income NUMERIC DEFAULT 0,
    misc_expenses NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Enable RLS for the costing_reports table
ALTER TABLE public.costing_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can manage their own costing reports
CREATE POLICY "Allow authenticated users to manage their own costing reports"
ON public.costing_reports
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- ========== Derived Ledgers (Notes) ==========
-- The Accounts Payable and Accounts Receivable ledgers are not separate tables.
-- They are derived by querying the `purchases` and `sales` tables.

-- Accounts Payable:
-- SELECT * FROM purchases WHERE paymentStatus = 'unpaid';

-- Accounts Receivable:
-- SELECT * FROM sales WHERE paymentStatus = 'unpaid';
