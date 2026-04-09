-- Multi-Branch Stock Management Migration
-- Adds branch-specific quantity and pricing columns to products,
-- and branch column to stock_logs and costing_reports.

-- ============================
-- 1. Products: Per-branch columns
-- ============================
ALTER TABLE products ADD COLUMN IF NOT EXISTS "quantity_dar" NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "quantity_arusha" NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "quantity_dodoma" NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "unitPrice_dar" NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "unitPrice_arusha" NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "unitPrice_dodoma" NUMERIC(10, 2) DEFAULT 0;

-- Migrate existing data into Dar es Salaam branch
UPDATE products
SET "quantity_dar" = quantity,
    "unitPrice_dar" = "unitPrice"
WHERE "quantity_dar" = 0 AND quantity > 0;

-- ============================
-- 2. Stock Logs: Add branch column
-- ============================
ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Dar es Salaam';

-- ============================
-- 3. Costing Reports: Add branch column
-- ============================
ALTER TABLE costing_reports ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Dar es Salaam';

-- Update unique constraint to include branch
ALTER TABLE costing_reports DROP CONSTRAINT IF EXISTS costing_reports_report_date_type_description_key;
ALTER TABLE costing_reports ADD CONSTRAINT costing_reports_report_date_type_description_branch_key
  UNIQUE(report_date, type, description, branch);
