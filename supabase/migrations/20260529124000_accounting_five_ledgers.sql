-- Migration: 5-Ledger Accounting System for Catering Operations
-- Description: Configures columns and tables for Sales, Purchases, Expenses, Payroll, and VAT/Withholding.
-- Jurisdiction: Tanzania Revenue Authority (TRA)
-- Core Principle: Event ID Linkage across all 5 ledgers.

-- 1. Sales Table updates
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS efd_receipt TEXT;
COMMENT ON COLUMN public.sales.event_id IS 'Master key (EVT-YYYY-MM-DD-XXXX) linking revenue to specific catering bookings';
COMMENT ON COLUMN public.sales.efd_receipt IS 'Official Electronic Fiscal Device receipt number for TRA VAT auditing';

-- 2. Purchases Table updates
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier_tin TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS efd_receipt TEXT;
COMMENT ON COLUMN public.purchases.event_id IS 'Master key linking ingredient purchases to specific events';
COMMENT ON COLUMN public.purchases.supplier_tin IS '9-digit Taxpayer Identification Number of the supplier, required by TRA';
COMMENT ON COLUMN public.purchases.efd_receipt IS 'Supplier EFD receipt number to validate input tax credits';

-- 3. Create Expenses Table (Separating Overhead from Purchases)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL, -- Either Event ID or 'OVERHEAD'
    date DATE NOT NULL,
    payee TEXT NOT NULL,
    ref_number TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Transport & Fuel', 'Utilities', 'Venue Rent', 'Kitchen Consumables', 'Marketing', 'Office Overhead')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    vat_amount NUMERIC(10, 2) DEFAULT 0,
    payment_md TEXT NOT NULL CHECK (payment_md IN ('cash', 'bank', 'mobile_money')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.expenses IS 'Ledger for general and event-specific operational overhead expenses';

-- 4. Payroll Table updates
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS event_id TEXT DEFAULT 'MONTHLY_CORE';
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS staff_type TEXT DEFAULT 'permanent' CHECK (staff_type IN ('permanent', 'casual'));
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS days_worked NUMERIC(5, 2) DEFAULT NULL;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12, 2) DEFAULT NULL;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS wcf_contrib NUMERIC(10, 2) DEFAULT 0;
COMMENT ON COLUMN public.payroll.event_id IS 'Links casual worker wages directly to specific events, or MONTHLY_CORE for permanent staff';

-- 5. Create VAT & Withholding Ledger Table
CREATE TABLE IF NOT EXISTS public.vat_wht_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    date DATE NOT NULL,
    tax_type TEXT NOT NULL CHECK (tax_type IN ('VAT Output', 'VAT Input', 'WHT Resident 5%', 'WHT Resident 2%', 'PAYE')),
    ref_ledger TEXT NOT NULL CHECK (ref_ledger IN ('sales', 'purchases', 'expenses', 'payroll')),
    ref_record UUID NOT NULL,
    base_amount NUMERIC(12, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL,
    filing_st TEXT NOT NULL CHECK (filing_st IN ('accrued', 'filed', 'paid')),
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.vat_wht_ledger IS 'Tanzanian tax ledger tracking VAT balances and Supplier/Casual Withholding taxes';
