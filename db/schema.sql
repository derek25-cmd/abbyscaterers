
-- Purchases Table
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  supplier TEXT NOT NULL,
  invoiceNumber TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unitCost NUMERIC NOT NULL,
  totalCost NUMERIC NOT NULL,
  taxAmount NUMERIC DEFAULT 0,
  paymentMethod TEXT NOT NULL, -- e.g., 'cash', 'bank', 'credit'
  paymentStatus TEXT NOT NULL, -- e.g., 'paid', 'unpaid'
  expenseCategory TEXT,
  createdAt TIMESTAMPTZ DEFAULT now(),
  updatedAt TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own purchases"
  ON purchases FOR ALL
  USING (auth.uid() = user_id);


-- Sales Table
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  customerId TEXT NOT NULL,
  invoiceNumber TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unitPrice NUMERIC NOT NULL,
  totalAmount NUMERIC NOT NULL,
  taxAmount NUMERIC DEFAULT 0,
  paymentMethod TEXT NOT NULL, -- e.g., 'cash', 'bank', 'credit'
  paymentStatus TEXT NOT NULL, -- e.g., 'paid', 'unpaid'
  createdAt TIMESTAMPTZ DEFAULT now(),
  updatedAt TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sales"
  ON sales FOR ALL
  USING (auth.uid() = user_id);

-- Costing Reports Table for Miscellaneous Items
CREATE TABLE costing_reports (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  report_date DATE NOT NULL,
  type TEXT NOT NULL, -- 'income' or 'expense'
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, type, description)
);

ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own costing reports"
  ON costing_reports FOR ALL
  USING (auth.uid() = user_id);

-- Note on Ledgers:
-- Accounts Payable and Accounts Receivable are not separate tables.
-- They are derived from the 'purchases' and 'sales' tables respectively.

-- To get Accounts Payable:
-- SELECT * FROM purchases WHERE paymentStatus = 'unpaid';

-- To get Accounts Receivable:
-- SELECT * FROM sales WHERE paymentStatus = 'unpaid';
