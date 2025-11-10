-- Enable the pgcrypto extension to use gen_random_uuid()
create extension if not exists pgcrypto with schema extensions;

-- Create the clients table
create table
  public.clients (
    id text not null,
    "companyName" text not null,
    "companyEmail" text null,
    "phoneNumber" text null,
    address1 text not null,
    address2 text null,
    "postalCode" text null,
    "primaryLocation" text not null,
    "typeOfOrganization" text not null,
    contacts jsonb null,
    "lastContacted" date not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint clients_pkey primary key (id)
  ) tablespace pg_default;

-- Create the equipment table
create table
  public.equipment (
    "equipmentNumber" text not null,
    "equipmentName" text not null,
    oem text null,
    model text null,
    "powerRating" text null,
    quantity integer not null,
    "yearOfManufacture" text null,
    "equipmentSource" text not null,
    capacity text null,
    commitment text not null,
    "registrationNumber" text null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint equipment_pkey primary key ("equipmentNumber")
  ) tablespace pg_default;

-- Create the ingredients table
create table
  public.ingredients (
    "itemNumber" text not null,
    "itemDescription" text not null,
    "itemClassification" text not null,
    units jsonb not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    "quantityUsed" numeric(10, 2) null default 0,
    user_id uuid null,
    constraint ingredients_pkey primary key ("itemNumber")
  ) tablespace pg_default;

-- Create the recipes table
create table
  public.recipes (
    "recipeNumber" text not null,
    "recipeName" text not null,
    "recipeType" text null,
    ingredients jsonb null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    user_id uuid null,
    constraint recipes_pkey primary key ("recipeNumber")
  ) tablespace pg_default;

-- Create the orders table
create table
  public.orders (
    id text not null default replace(uuid_generate_v4()::text, '-', ''),
    name text not null,
    description text null,
    "proformaId" text null,
    "clientEvents" jsonb not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    booking_id text null,
    constraint orders_pkey primary key (id)
  ) tablespace pg_default;

-- Create the proforma_invoices table
create table
  public.proforma_invoices (
    id text not null,
    "invoiceDate" date not null,
    "clientId" text null,
    "receiverName" text null,
    "receiverPosition" text null,
    "lpoNumber" text null,
    location text null,
    "numberOfDays" integer not null,
    "multiplyByDays" boolean not null,
    "serviceCharge" numeric(10, 2) not null,
    "transportCosts" numeric(10, 2) not null,
    "vatType" text not null,
    "selectedEventType" text null,
    "customEventType" text null,
    "startDate" date not null,
    "endDate" date not null,
    "serviceFields" jsonb not null,
    "serviceDesc" text null,
    items jsonb not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    "isInvoiced" boolean null default false,
    booking_id text null,
    constraint proforma_invoices_pkey primary key (id)
  ) tablespace pg_default;

-- Create the invoices table
create table
  public.invoices (
    id text not null,
    "proformaId" text null,
    status text not null,
    "invoiceDate" date not null,
    "clientId" text null,
    "receiverName" text null,
    "receiverPosition" text null,
    "lpoNumber" text null,
    location text null,
    "numberOfDays" integer not null,
    "multiplyByDays" boolean not null,
    "serviceCharge" numeric(10, 2) not null,
    "transportCosts" numeric(10, 2) not null,
    "vatType" text not null,
    "selectedEventType" text null,
    "customEventType" text null,
    "startDate" date null,
    "endDate" date null,
    "serviceFields" jsonb not null,
    "serviceDesc" text null,
    items jsonb not null,
    "signedAtDate" date null,
    "signedAtLocation" text null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint invoices_pkey primary key (id)
  ) tablespace pg_default;

-- Create the bookings table
create table
  public.bookings (
    id text not null,
    client_id text not null,
    user_id uuid not null,
    name text not null,
    start_date date not null,
    end_date date not null,
    status text not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    proforma_invoice_id text null,
    constraint bookings_pkey primary key (id),
    constraint bookings_proforma_invoice_id_key unique (proforma_invoice_id)
  ) tablespace pg_default;

-- Create the delivery_notes table
create table
  public.delivery_notes (
    id text not null,
    order_id text not null,
    client_id text not null,
    client_name text not null,
    delivery_date date not null,
    delivery_location text not null,
    vehicle_reg_no text null,
    delivered_by text not null,
    items jsonb not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    user_id uuid not null,
    constraint delivery_notes_pkey primary key (id)
  ) tablespace pg_default;

-- Create the assets table
create table
  public.assets (
    id uuid not null default gen_random_uuid (),
    name text not null,
    type text not null,
    unit text not null,
    "unitPrice" numeric(12, 2) not null,
    quantity integer not null,
    status text not null,
    branch text not null,
    "lastMaintenance" date null,
    "nextMaintenance" date null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint assets_pkey primary key (id)
  ) tablespace pg_default;

-- Create the issuance table
create table
  public.issuance (
    id uuid not null default gen_random_uuid (),
    orderId text not null,
    issuedTo text not null,
    date date not null,
    status text not null,
    branch text not null,
    items jsonb not null,
    totalValue numeric(12, 2) not null,
    notes text null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint issuance_pkey primary key (id)
  ) tablespace pg_default;

-- Create the products table
create table
  public.products (
    id text not null,
    sku text not null,
    name text not null,
    category text not null,
    quantity integer not null,
    unit text not null,
    "unitPrice" integer not null,
    "minStock" integer not null,
    "maxStock" integer null,
    "expiryDate" date null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint products_pkey primary key (id),
    constraint products_sku_key unique (sku)
  ) tablespace pg_default;

-- Create the stock_logs table
create table
  public.stock_logs (
    id text not null,
    "productId" text not null,
    "productName" text not null,
    type text not null,
    quantity integer not null,
    price integer not null,
    reason text not null,
    date date not null,
    status text not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    actual_unit_price integer null,
    constraint stock_logs_pkey primary key (id)
  ) tablespace pg_default;

-- Create the daily_menus table
create table
  public.daily_menus (
    id bigint generated by default as identity,
    order_id text not null,
    menu_date date not null,
    recipes jsonb null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint daily_menus_pkey primary key (id),
    constraint daily_menus_order_id_menu_date_key unique (order_id, menu_date)
  ) tablespace pg_default;

-- Create the employees table
create table
  public.employees (
    id text not null,
    "firstName" text not null,
    "middleName" text null,
    "lastName" text not null,
    dob date null,
    gender text null,
    nationality text null,
    "nationalId" text null,
    tin text null,
    phone text null,
    email text null,
    address text null,
    "emergencyContactName" text null,
    "emergencyContactRelationship" text null,
    "emergencyContactPhone" text null,
    role text not null,
    department text not null,
    status text not null,
    "monthlySalary" numeric(12, 2) null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint employees_pkey primary key (id)
  ) tablespace pg_default;

-- Create the attendance table
create table
  public.attendance (
    id uuid not null default gen_random_uuid (),
    employee text not null,
    date date not null,
    "clockIn" text not null,
    "clockOut" text not null,
    "totalHours" text not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint attendance_pkey primary key (id)
  ) tablespace pg_default;

-- Create the positions table
create table
  public.positions (
    id uuid not null default gen_random_uuid (),
    title text not null,
    department text not null,
    location text not null,
    type text not null,
    applicants integer not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint positions_pkey primary key (id)
  ) tablespace pg_default;

-- Create the payroll table
create table
  public.payroll (
    id text not null,
    "employeeId" text not null,
    "employeeName" text not null,
    "payPeriodStart" date not null,
    "payPeriodEnd" date not null,
    "basicSalary" numeric(12, 2) not null,
    allowances numeric(12, 2) not null,
    deductions numeric(12, 2) not null,
    "grossSalary" numeric(12, 2) not null,
    "netSalary" numeric(12, 2) not null,
    status text not null,
    "paymentDate" date null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint payroll_pkey primary key (id)
  ) tablespace pg_default;

-- Create the purchases table
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

-- Create the sales table
create table
  public.sales (
    id uuid not null default gen_random_uuid (),
    date date not null,
    "customerId" text not null,
    "invoiceNumber" text not null,
    description text not null,
    quantity numeric(10, 2) not null,
    "unitPrice" numeric(10, 2) not null,
    "totalAmount" numeric(12, 2) not null,
    "taxAmount" numeric(10, 2) null default 0,
    "paymentMethod" text null,
    "paymentStatus" text not null,
    "createdAt" timestamp with time zone not null default now(),
    "updatedAt" timestamp with time zone not null default now(),
    constraint sales_pkey primary key (id)
  ) tablespace pg_default;

-- Create the costing_reports table
create table
  public.costing_reports (
    id bigint generated by default as identity,
    report_date date not null,
    type text not null,
    description text not null,
    amount numeric(12, 2) not null,
    created_at timestamp with time zone not null default now(),
    constraint costing_reports_pkey primary key (id)
  ) tablespace pg_default;

-- Alter products table to allow decimal values for quantity, price and stock levels
ALTER TABLE products
ALTER COLUMN quantity TYPE NUMERIC(10, 2),
ALTER COLUMN "unitPrice" TYPE NUMERIC(10, 2),
ALTER COLUMN "minStock" TYPE NUMERIC(10, 2);

-- Alter stock_logs table to allow decimal values for quantity and price
ALTER TABLE stock_logs
ALTER COLUMN quantity TYPE NUMERIC(10, 2),
ALTER COLUMN price TYPE NUMERIC(10, 2),
ALTER COLUMN actual_unit_price TYPE NUMERIC(10, 2);
