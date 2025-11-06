-- This SQL schema is designed for a PostgreSQL database, compatible with Supabase.
-- It defines the core tables for the finance module based on IFRS principles.

-- =================================================================
-- 1. PURCHASES BOOK
-- Purpose: Records all goods and services bought by the company.
-- Corresponds to the "Purchases Book" in the application.
-- =================================================================
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    supplier TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    "unitCost" NUMERIC NOT NULL CHECK ("unitCost" >= 0),
    "totalCost" NUMERIC NOT NULL CHECK ("totalCost" >= 0),
    "taxAmount" NUMERIC NOT NULL DEFAULT 0 CHECK ("taxAmount" >= 0),
    "paymentMethod" TEXT NOT NULL CHECK ("paymentMethod" IN ('cash', 'bank', 'credit')),
    "paymentStatus" TEXT NOT NULL CHECK ("paymentStatus" IN ('paid', 'unpaid')),
    "expenseCategory" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE purchases IS 'Stores all purchase transactions, forming the basis for the Purchases Book.';


-- =================================================================
-- 2. SALES BOOK
-- Purpose: Records all revenue-generating activities.
-- Corresponds to the "Sales Book" in the application.
-- =================================================================
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    "customerId" TEXT NOT NULL, -- In the app, this links to the clients table/storage.
    "invoiceNumber" TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    "unitPrice" NUMERIC NOT NULL CHECK ("unitPrice" >= 0),
    "totalAmount" NUMERIC NOT NULL CHECK ("totalAmount" >= 0),
    "taxAmount" NUMERIC NOT NULL DEFAULT 0 CHECK ("taxAmount" >= 0),
    "paymentMethod" TEXT NOT NULL CHECK ("paymentMethod" IN ('cash', 'bank', 'credit')),
    "paymentStatus" TEXT NOT NULL CHECK ("paymentStatus" IN ('paid', 'unpaid')),
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE sales IS 'Stores all sales transactions, forming the basis for the Sales Book.';


-- =================================================================
-- 3. ACCOUNTS PAYABLE LEDGER (Derived View)
-- Purpose: Tracks amounts the company owes to suppliers.
-- This is not a separate table but a VIEW derived from the 'purchases' table.
-- The application creates this ledger by filtering purchases where paymentStatus = 'unpaid'.
-- =================================================================
CREATE OR REPLACE VIEW accounts_payable_ledger AS
SELECT
    id,
    supplier,
    "invoiceNumber",
    date AS due_date, -- Assuming due date is the purchase date for simplicity
    "totalCost" AS amount_due
FROM
    purchases
WHERE
    "paymentStatus" = 'unpaid';

COMMENT ON VIEW accounts_payable_ledger IS 'A derived view showing all unpaid purchases, representing the accounts payable ledger.';


-- =================================================================
-- 4. ACCOUNTS RECEIVABLE LEDGER (Derived View)
-- Purpose: Tracks amounts owed by customers.
-- This is not a separate table but a VIEW derived from the 'sales' table.
-- The application creates this ledger by filtering sales where paymentStatus = 'unpaid'.
-- =================================================================
CREATE OR REPLACE VIEW accounts_receivable_ledger AS
SELECT
    id,
    "customerId",
    "invoiceNumber",
    date AS due_date, -- Assuming due date is the sale date for simplicity
    "totalAmount" AS amount_due
FROM
    sales
WHERE
    "paymentStatus" = 'unpaid';

COMMENT ON VIEW accounts_receivable_ledger IS 'A derived view showing all unpaid sales, representing the accounts receivable ledger.';

-- =================================================================
-- NOTES ON INTEGRATION:
--
-- - Inventory/Stock: Stock levels are updated based on 'purchases' (stock in)
--   and 'sales' (stock out). A separate 'stock_logs' table might be used for
--   more granular tracking, as implemented in the HR & Operations module.
--
-- - Cash Book: A dedicated 'cash_book' table would be created to log all
--   transactions. When a purchase or sale is marked as 'paid', a corresponding
--   entry would be made in the cash book.
--
-- - General Ledger: In a full-scale accounting system, every transaction
--   from these tables would generate a corresponding double-entry journal
--   in a 'general_ledger' table.
-- =================================================================
