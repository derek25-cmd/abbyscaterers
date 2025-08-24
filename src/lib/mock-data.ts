
// @ts-nocheck
// Mock Data for CaterEase HR & Operations Module

// Operations: Asset Management
export const assets = [
  {
    id: "ASSET001",
    name: "Ford Transit Van",
    type: "Vehicle",
    unit: "pcs",
    unitPrice: 75000000,
    quantity: 1,
    status: "Available",
    lastMaintenance: "2024-05-01",
    nextMaintenance: "2024-11-01",
  },
  {
    id: "ASSET002",
    name: "Industrial Mixer",
    type: "Kitchen Equipment",
    unit: "pcs",
    unitPrice: 5000000,
    quantity: 1,
    status: "Available",
    lastMaintenance: "2024-06-15",
    nextMaintenance: "2024-12-15",
  },
  {
    id: "ASSET003",
    name: "Box Truck",
    type: "Vehicle",
    unit: "pcs",
    unitPrice: 120000000,
    quantity: 1,
    status: "Under Maintenance",
    lastMaintenance: "2024-07-20",
    nextMaintenance: "2024-08-01",
  },
  {
    id: "ASSET004",
    name: "Chafing Dishes",
    type: "Service Utensil",
    unit: "sets",
    unitPrice: 500000,
    quantity: 20,
    status: "Available",
    lastMaintenance: "N/A",
    nextMaintenance: "N/A",
  },
  {
    id: "ASSET005",
    name: "Portable Bar Station",
    type: "Event Equipment",
    unit: "pcs",
    unitPrice: 2500000,
    quantity: 1,
    status: "Available",
    lastMaintenance: "2024-03-10",
    nextMaintenance: "2024-09-10",
  },
];

// Operations: Inventory Management (Stock)
export const stockInventory = [
  { id: "PROD001", sku: "FG-APF-001", name: "All-Purpose Flour", category: "Food", quantity: 50, unit: "kg", unitPrice: 3000, minStock: 10, maxStock: 100, expiryDate: "2025-12-31" },
  { id: "PROD002", sku: "FG-SUG-001", name: "Granulated Sugar", category: "Food", quantity: 40, unit: "kg", unitPrice: 4000, minStock: 10, maxStock: 80, expiryDate: "2026-06-30" },
  { id: "PROD003", sku: "FG-OIL-001", name: "Olive Oil", category: "Food", quantity: 15, unit: "liters", unitPrice: 12000, minStock: 5, maxStock: 30, expiryDate: "2025-08-15" },
  { id: "PROD004", sku: "CS-NAP-001", name: "Napkins (Pack of 100)", category: "Cleaning", quantity: 200, unit: "packs", unitPrice: 2500, minStock: 50, maxStock: 500, expiryDate: null },
  { id: "PROD005", sku: "FG-CKN-001", name: "Frozen Chicken Breast", category: "Food", quantity: 8, unit: "kg", unitPrice: 18000, minStock: 10, maxStock: 50, expiryDate: "2025-01-20" },
  { id: "PROD006", sku: "EQ-CKN-001", name: "Chef's Knife", category: "Equipment", quantity: 25, unit: "pcs", unitPrice: 75000, minStock: 5, maxStock: 30, expiryDate: null },
];

// Operations: Stock Logs
export const stockLogs = [
  { id: "LOG001", productId: "PROD001", productName: "All-Purpose Flour", type: "Stock In", quantity: 20, price: 60000, reason: "Vendor Delivery", date: "2024-07-25", status: "Stock In" },
  { id: "LOG002", productId: "PROD002", productName: "Granulated Sugar", type: "Stock Out", quantity: 5, price: 20000, reason: "Customer Order: ORD-2024-01", date: "2024-07-25", status: "Stock Out" },
  { id: "LOG003", productId: "PROD004", productName: "Napkins (Pack of 100)", type: "Stock In", quantity: 100, price: 250000, reason: "Vendor Delivery", date: "2024-07-24", status: "Stock In" },
  { id: "LOG004", productId: "PROD005", productName: "Frozen Chicken Breast", type: "Stock Out", quantity: 2, price: 36000, reason: "Spoilage", date: "2024-07-23", status: "Stock Out" },
  { id: "LOG005", productId: "PROD003", productName: "Olive Oil", type: "Stock In", quantity: 10, price: 120000, reason: "Internal Production", date: "2024-07-22", status: "Stock In" },
];


// Operations: Daily Issuance (now tied to stockInventory)
export const issuanceLog = [
  {
    id: "ISS001",
    assetId: "ASSET001", // Ford Transit Van
    name: "Ford Transit Van",
    issuedTo: "Peter Jones",
    type: "Vehicle",
    unit: "pcs",
    unitPrice: 75000000,
    quantity: 1,
    date: "2024-07-25",
    status: "Issued"
  },
  {
    id: "ISS002",
    assetId: "ASSET002", // Industrial Mixer
    name: "Industrial Mixer",
    issuedTo: "John Smith",
    type: "Kitchen Equipment",
    unit: "pcs",
    unitPrice: 5000000,
    quantity: 1,
    date: "2024-07-26",
    status: "Issued"
  },
];

// HR: Employee Records
export const employees = [
  { 
    id: "EMP001", 
    firstName: "John",
    middleName: "A.",
    lastName: "Smith",
    dob: "1985-05-20",
    gender: "Male",
    nationality: "Tanzanian",
    nationalId: "19850520-12345-1",
    tin: "100-123-456",
    phone: "0755-123456",
    email: "john.smith@example.com",
    address: "123 Mjini St, Dar es Salaam",
    emergencyContactName: "Jane Smith",
    emergencyContactRelationship: "Wife",
    emergencyContactPhone: "0755-654321",
    role: "Head Chef", 
    department: "Kitchen", 
    status: "Active" 
  },
  { 
    id: "EMP002", 
    firstName: "Jane",
    middleName: "M.",
    lastName: "Doe",
    dob: "1990-09-15",
    gender: "Female",
    nationality: "Tanzanian",
    nationalId: "19900915-54321-2",
    tin: "100-321-654",
    phone: "0766-112233",
    email: "jane.doe@example.com",
    address: "456 Pwani Rd, Dar es Salaam",
    emergencyContactName: "John Doe",
    emergencyContactRelationship: "Husband",
    emergencyContactPhone: "0766-332211",
    role: "Events Manager", 
    department: "Operations", 
    status: "Active" 
  },
  { 
    id: "EMP003", 
    firstName: "Peter",
    middleName: "",
    lastName: "Jones",
    dob: "1988-12-01",
    gender: "Male",
    nationality: "Kenyan",
    nationalId: "K-12345678",
    tin: "101-234-567",
    phone: "0777-987654",
    email: "peter.jones@example.com",
    address: "789 Barabara St, Dar es Salaam",
    emergencyContactName: "Mary Jones",
    emergencyContactRelationship: "Sister",
    emergencyContactPhone: "0777-456789",
    role: "Driver", 
    department: "Logistics", 
    status: "Active" 
  },
  { 
    id: "EMP004", 
    firstName: "Emily",
    middleName: "S.",
    lastName: "White",
    dob: "1992-02-25",
    gender: "Female",
    nationality: "Tanzanian",
    nationalId: "19920225-67890-3",
    tin: "102-456-789",
    phone: "0788-555666",
    email: "emily.white@example.com",
    address: "321 Jiji Ave, Dar es Salaam",
    emergencyContactName: "David White",
    emergencyContactRelationship: "Brother",
    emergencyContactPhone: "0788-666555",
    role: "Sous Chef", 
    department: "Kitchen", 
    status: "Active" 
  },
  { 
    id: "EMP005", 
    firstName: "Michael",
    middleName: "B.",
    lastName: "Brown",
    dob: "1995-07-30",
    gender: "Male",
    nationality: "Ugandan",
    nationalId: "U-98765432",
    tin: "103-567-890",
    phone: "0799-123123",
    email: "michael.brown@example.com",
    address: "654 Njia Kuu, Dar es Salaam",
    emergencyContactName: "Susan Brown",
    emergencyContactRelationship: "Mother",
    emergencyContactPhone: "0799-321321",
    role: "Server", 
    department: "Service Staff", 
    status: "Inactive" 
  },
  { 
    id: "EMP006", 
    firstName: "Sarah",
    middleName: "L.",
    lastName: "Green",
    dob: "1989-11-10",
    gender: "Female",
    nationality: "Tanzanian",
    nationalId: "19891110-24680-4",
    tin: "104-678-901",
    phone: "0711-888999",
    email: "sarah.green@example.com",
    address: "987 Mtaa St, Dar es Salaam",
    emergencyContactName: "Tom Green",
    emergencyContactRelationship: "Husband",
    emergencyContactPhone: "0711-999888",
    role: "HR Manager", 
    department: "Admin", 
    status: "Active" 
  },
];

// HR: Attendance
export const attendanceRecords = [
  { id: "ATT001", employee: "John Smith", date: "2024-07-26", clockIn: "08:02 AM", clockOut: "05:05 PM", totalHours: "9h 3m" },
  { id: "ATT002", employee: "Jane Doe", date: "2024-07-26", clockIn: "09:00 AM", clockOut: "06:15 PM", totalHours: "9h 15m" },
  { id: "ATT003", employee: "Peter Jones", date: "2024-07-26", clockIn: "07:30 AM", clockOut: "04:30 PM", totalHours: "9h 0m" },
  { id: "ATT004", employee: "Emily White", date: "2024-07-26", clockIn: "08:05 AM", clockOut: "05:10 PM", totalHours: "9h 5m" },
  { id: "ATT005", employee: "Sarah Green", date: "2024-07-26", clockIn: "08:55 AM", clockOut: "05:30 PM", totalHours: "8h 35m" },
];

// HR: Recruitment / Job Board
export const openPositions = [
  {
    id: "JOB001",
    title: "Pastry Chef",
    department: "Kitchen",
    location: "Main Kitchen",
    type: "Full-time",
    applicants: 12,
  },
  {
    id: "JOB002",
    title: "Event Coordinator",
    department: "Operations",
    location: "Remote/On-site",
    type: "Full-time",
    applicants: 35,
  },
  {
    id: "JOB003",
    title: "Delivery Driver",
    department: "Logistics",
    location: "On the Road",
    type: "Part-time",
    applicants: 21,
  },
  {
    id: "JOB004",
    title: "Bartender",
    department: "Service Staff",
    location: "Various Events",
    type: "Contract",
    applicants: 45,
  },
];

// HR: Payroll
export const payrolls = [
    {
        id: "PAY001",
        employeeId: "EMP001",
        employeeName: "John Smith",
        payPeriodStart: "2024-07-01T00:00:00.000Z",
        payPeriodEnd: "2024-07-31T00:00:00.000Z",
        basicSalary: 3000000,
        allowances: 500000,
        deductions: 450000,
        grossSalary: 3500000,
        netSalary: 3050000,
        status: 'Paid',
        paymentDate: "2024-07-28"
    },
    {
        id: "PAY002",
        employeeId: "EMP002",
        employeeName: "Jane Doe",
        payPeriodStart: "2024-07-01T00:00:00.000Z",
        payPeriodEnd: "2024-07-31T00:00:00.000Z",
        basicSalary: 2500000,
        allowances: 300000,
        deductions: 350000,
        grossSalary: 2800000,
        netSalary: 2450000,
        status: 'Pending',
        paymentDate: null
    }
];


// For Dashboard
export const recentIssuances = [
  {
    id: "ISS002",
    item: "Ford Transit Van",
    employee: { name: "John Smith", role: "Driver" },
    date: "2024-07-26",
  },
  {
    id: "ISS003",
    item: "Serving Spoons (x20)",
    employee: { name: "Emily White", role: "Sous Chef" },
    date: "2024-07-26",
  },
  {
    id: "ISS005",
    item: "Portable Bar Station",
    employee: { name: "Jane Doe", role: "Events Manager" },
    date: "2024-07-26",
  },
  {
    id: "ISS001",
    item: "Wine Glasses (x50)",
    employee: { name: "Jane Doe", role: "Events Manager" },
    date: "2024-07-25",
  },
  {
    id: "ISS004",
    item: "Tablecloths (x20)",
    employee: { name: "Michael Brown", role: "Server" },
    date: "2024-07-24",
  },
];
