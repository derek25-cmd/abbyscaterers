-- Migration: Add missing columns to stock_logs table
-- Run this in your Supabase SQL Editor

-- 1. Add 'branch' column to stock_logs (was missing — caused all stock log inserts to fail)
ALTER TABLE stock_logs
    ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Dar es Salaam';

-- 2. Update schema.sql reference: products table also needs per-branch columns
--    (already applied live, but recorded here for completeness)
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS quantity_dar    NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantity_arusha NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantity_dodoma NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "unitPrice_dar"    NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "unitPrice_arusha" NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "unitPrice_dodoma" NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. Verify: after running, check that existing stock logs are patched
UPDATE stock_logs
SET branch = 'Dar es Salaam'
WHERE branch IS NULL;
