-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    companyName TEXT NOT NULL,
    companyEmail TEXT,
    phoneNumber TEXT,
    address1 TEXT,
    address2 TEXT,
    postalCode TEXT,
    primaryLocation TEXT,
    typeOfOrganization TEXT,
    contacts JSONB,
    lastContacted DATE,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
    equipmentNumber TEXT PRIMARY KEY,
    equipmentName TEXT NOT NULL,
    oem TEXT,
    model TEXT,
    powerRating TEXT,
    quantity INTEGER,
    yearOfManufacture TEXT,
    equipmentSource TEXT,
    capacity TEXT,
    commitment TEXT,
    registrationNumber TEXT,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
    itemNumber TEXT PRIMARY KEY,
    itemDescription TEXT NOT NULL,
    itemClassification TEXT,
    units JSONB,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
    recipeNumber TEXT PRIMARY KEY,
    recipeName TEXT NOT NULL,
    recipeType TEXT,
    ingredients JSONB,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    proformaId TEXT,
    clientEvents JSONB,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now(),
    booking_id TEXT
);


-- Proforma Invoices table
CREATE TABLE IF NOT EXISTS proforma_invoices (
    id TEXT PRIMARY KEY,
    invoiceDate DATE NOT NULL,
    clientId TEXT,
    receiverName TEXT,
    receiverPosition TEXT,
    lpoNumber TEXT,
    location TEXT,
    numberOfDays INTEGER,
    multiplyByDays BOOLEAN,
    serviceCharge NUMERIC(12, 2),
    transportCosts NUMERIC(12, 2),
    vatType TEXT,
    selectedEventType TEXT,
    customEventType TEXT,
    startDate DATE,
    endDate DATE,
    serviceFields JSONB,
    serviceDesc TEXT,
    items JSONB,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now(),
    isInvoiced BOOLEAN DEFAULT false,
    booking_id TEXT
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    proformaId TEXT,
    status TEXT,
    invoiceDate DATE NOT NULL,
    clientId TEXT,
    receiverName TEXT,
    receiverPosition TEXT,
    lpoNumber TEXT,
    location TEXT,
    numberOfDays INTEGER,
    multiplyByDays BOOLEAN,
    serviceCharge NUMERIC(12, 2),
    transportCosts NUMERIC(12, 2),
    vatType TEXT,
    selectedEventType TEXT,
    customEventType TEXT,
    startDate DATE,
    endDate DATE,
    serviceFields JSONB,
    serviceDesc TEXT,
    items JSONB,
    signedAtDate DATE,
    signedAtLocation TEXT,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    proforma_invoice_id TEXT UNIQUE
);

ALTER TABLE bookings 
ADD CONSTRAINT fk_proforma_invoice 
FOREIGN KEY (proforma_invoice_id) 
REFERENCES proforma_invoices(id);

ALTER TABLE proforma_invoices
ADD CONSTRAINT fk_booking
FOREIGN KEY (booking_id)
REFERENCES bookings(id)
ON DELETE SET NULL;


-- Delivery Notes table
CREATE TABLE IF NOT EXISTS delivery_notes (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    delivery_date DATE NOT NULL,
    delivery_location TEXT NOT NULL,
    vehicle_reg_no TEXT,
    delivered_by TEXT NOT NULL,
    items JSONB NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    unit TEXT NOT NULL,
    unitPrice NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL,
    branch TEXT,
    lastMaintenance DATE,
    nextMaintenance DATE,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Issuance table
CREATE TABLE IF NOT EXISTS issuance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orderId TEXT,
    issuedTo TEXT,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    branch TEXT,
    items JSONB,
    totalValue NUMERIC(12, 2),
    notes TEXT,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firstName TEXT NOT NULL,
    middleName TEXT,
    lastName TEXT NOT NULL,
    dob DATE,
    gender TEXT,
    nationality TEXT,
    nationalId TEXT,
    tin TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    emergencyContactName TEXT,
    emergencyContactRelationship TEXT,
    emergencyContactPhone TEXT,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL,
    monthlySalary NUMERIC(12, 2),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee TEXT NOT NULL,
    date DATE NOT NULL,
    clockIn TEXT,
    clockOut TEXT,
    totalHours TEXT,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL,
    applicants INTEGER DEFAULT 0,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employeeId UUID NOT NULL,
    employeeName TEXT NOT NULL,
    payPeriodStart DATE NOT NULL,
    payPeriodEnd DATE NOT NULL,
    basicSalary NUMERIC(12, 2) NOT NULL,
    allowances NUMERIC(12, 2) DEFAULT 0,
    deductions NUMERIC(12, 2) DEFAULT 0,
    grossSalary NUMERIC(12, 2) NOT NULL,
    netSalary NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL,
    paymentDate DATE,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT,
    name TEXT NOT NULL,
    category TEXT,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT,
    unitPrice NUMERIC(10, 2),
    minStock INTEGER,
    maxStock INTEGER,
    expiryDate DATE,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);

-- Stock Logs table
CREATE TABLE IF NOT EXISTS stock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    productId UUID REFERENCES products(id),
    productName TEXT,
    type TEXT,
    quantity NUMERIC(10, 2) NOT NULL,
    price NUMERIC(12, 2),
    reason TEXT,
    date DATE,
    status TEXT,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now(),
    actual_unit_price numeric(10,2)
);

-- Daily Menus table
CREATE TABLE IF NOT EXISTS daily_menus (
    id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL,
    menu_date DATE NOT NULL,
    recipes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id, menu_date)
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    supplier TEXT NOT NULL,
    invoicenumber TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unitcost NUMERIC(10, 2) NOT NULL,
    totalcost NUMERIC(12, 2) NOT NULL,
    taxamount NUMERIC(10, 2) DEFAULT 0,
    paymentmethod TEXT CHECK (paymentmethod IN ('cash', 'bank', 'credit')),
    paymentstatus TEXT CHECK (paymentstatus IN ('paid', 'unpaid')),
    expensecategory TEXT,
    user_id UUID REFERENCES auth.users(id),
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
);


-- Sales table
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
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);


CREATE TABLE IF NOT EXISTS costing_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);


ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE costing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their own purchases" ON purchases
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage their own sales" ON sales
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage their own costing reports" ON costing_reports
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
