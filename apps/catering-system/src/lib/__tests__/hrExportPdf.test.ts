import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { buildEmployeeDirectoryPdf, buildIssuanceNotePdf, employeeDirectoryFileName } from '../hrExportPdf';
import { buildPayslipPdf } from '../payslipPdf';
import type { Employee, Issuance, Payroll } from '@/types';

/** Everything drawn on one page, as text (jsPDF's page content stream). */
const pageText = (doc: jsPDF, page: number) =>
  ((doc.internal as unknown as { pages: string[][] }).pages[page] ?? []).join('\n');
const allText = (doc: jsPDF) =>
  Array.from({ length: doc.getNumberOfPages() }, (_, i) => pageText(doc, i + 1)).join('\n');

const emp = (i: number, over: Partial<Employee> = {}): Partial<Employee> => ({
  id: `EMP-${String(i).padStart(3, '0')}`, firstName: `First${i}`, lastName: `Last${i}`, department: 'Kitchen',
  role: 'Cook', status: 'Active', email: `p${i}@example.com`, phone: '0712 000 000', monthlySalary: 800000, ...over,
});

describe('employee directory PDF', () => {
  it('lists every employee with their details and the total', () => {
    const doc = buildEmployeeDirectoryPdf([emp(1), emp(2, { status: 'Inactive' })], { activeOnly: false, generatedAt: new Date(2026, 9, 15) });
    const text = allText(doc);
    expect(text).toContain('FULL STAFF DIRECTORY');
    expect(text).toContain('Total Employees: 2');
    expect(text).toContain('EMP-001');
    expect(text).toContain('First2 Last2');
    expect(text).toContain('800,000');
    expect(text).toContain('Inactive');
  });

  it('"Active only" leaves out inactive employees', () => {
    const text = allText(buildEmployeeDirectoryPdf([emp(1), emp(2, { status: 'Inactive' })], { activeOnly: true }));
    expect(text).toContain('ACTIVE STAFF DIRECTORY');
    expect(text).toContain('Total Employees: 1');
    expect(text).not.toContain('EMP-002');
  });

  it('runs onto more pages for a big staff list, numbering every page', () => {
    const doc = buildEmployeeDirectoryPdf(Array.from({ length: 80 }, (_, i) => emp(i + 1)), { activeOnly: false });
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    for (let p = 1; p <= pages; p++) expect(pageText(doc, p)).toContain(`Page ${p} of ${pages}`);
    expect(allText(doc)).toContain('EMP-080');
  });

  it('copes with missing optional fields and produces a real PDF file', () => {
    const doc = buildEmployeeDirectoryPdf([{ id: 'EMP-9', firstName: 'Only', lastName: 'Name', status: 'Active' }], { activeOnly: false });
    expect(allText(doc)).toContain('Only Name');
    expect(doc.output().startsWith('%PDF-')).toBe(true);
    expect(employeeDirectoryFileName(true, new Date(2026, 9, 15))).toBe('employee-directory-active-2026-10-15.pdf');
  });
});

describe('issuance note PDF', () => {
  const entry = {
    id: 'ISS-0007', orderId: 'ORD-12', issuedTo: 'Amina Juma', date: '2026-10-15', status: 'Issued', branch: 'Dar es Salaam',
    items: [
      { name: 'Chafing dish', type: 'Equipment', quantityIssued: 4, quantityReturned: 1, unitPrice: 50000 },
      { name: 'Table cloth', type: 'Linen', quantityIssued: 10, unitPrice: 5000 },
    ],
    totalValue: 250000, notes: 'Return by Friday.', createdAt: '', updatedAt: '',
    order: { name: 'Wedding – Juma' },
  } as unknown as Issuance & { order: { name: string } };

  it('prints the header, every item, the grand total and the notes', () => {
    const text = allText(buildIssuanceNotePdf(entry as never));
    for (const s of ['Issuance Note', 'ISS-0007', 'Amina Juma', 'ORD-12', 'Chafing dish', 'Table cloth', 'Grand Total Value', '250,000', 'Return by Friday.']) {
      expect(text).toContain(s);
    }
  });

  it('works without notes or an order', () => {
    const doc = buildIssuanceNotePdf({ ...entry, notes: undefined, order: undefined } as never);
    expect(allText(doc)).toContain('Client Order: N/A');
    expect(allText(doc)).not.toContain('Notes:');
  });
});

describe('payslip PDF', () => {
  it('builds a payslip with the employee, the period and the net pay', () => {
    const payroll = {
      id: 'PAY-001', employeeId: 'EMP-001', employeeName: 'First1 Last1', payPeriodStart: '2026-09-01', payPeriodEnd: '2026-09-30',
      basicSalary: 800000, allowances: 50000, deductions: 120000, grossSalary: 850000, netSalary: 730000,
      paye_amount: 60000, nssf_employee: 60000, status: 'Paid', paymentDate: '2026-09-30',
    } as unknown as Payroll;
    const { doc, filename } = buildPayslipPdf(payroll, emp(1) as Employee);
    const text = allText(doc);
    expect(text).toContain('Payslip');
    expect(text).toContain('First1 Last1');
    expect(text).toContain('730,000');
    expect(doc.output().startsWith('%PDF-')).toBe(true);
    expect(filename).toBe('Payslip_First1_Last1_2026-09-01.pdf');
  });
});
