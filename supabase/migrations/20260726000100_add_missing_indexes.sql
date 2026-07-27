-- Adds indexes on FK/filter columns identified in the audit as missing.
-- CREATE INDEX IF NOT EXISTS is natively idempotent, so no pre-check
-- against live state is needed here (unlike the FK/RPC migrations, where
-- "already exists" isn't a supported IF NOT EXISTS clause for ADD
-- CONSTRAINT). Column names verified against the live PostgREST OpenAPI
-- schema, not just schema.sql, given this project's demonstrated drift
-- between the two (see prior migrations' comments for specifics).

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices ("clientId");
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_client_id ON public.proforma_invoices ("clientId");
CREATE INDEX IF NOT EXISTS idx_sales_customerid ON public.sales (customerid);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders (client_id);
CREATE INDEX IF NOT EXISTS idx_orders_booking_id ON public.orders (booking_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON public.stock_logs ("productId");

-- These date/createdAt columns are the .order()-by column in every
-- paginated getX() service function (invoiceService, proformaInvoiceService,
-- orderService, saleService, stockLogService) — indexing them keeps
-- pagination fast as each table grows past a full-table-scan-friendly size.
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices ("createdAt");
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_created_at ON public.proforma_invoices ("createdAt");
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders ("createdAt");
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales (date);
CREATE INDEX IF NOT EXISTS idx_stock_logs_date ON public.stock_logs (date);
