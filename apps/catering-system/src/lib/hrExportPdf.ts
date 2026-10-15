import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Employee, Issuance, Order } from '@/types';

/**
 * The HR module's table exports (employee directory, asset issuance note),
 * built here rather than inside the screens so they can be tested. Direct
 * jsPDF + autoTable, like payslipPdf.ts. The callers save the returned doc.
 */

const fullName = (e: Partial<Employee> | undefined) =>
  e ? [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') : 'N/A';

const tzs = (n: number) =>
  new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

/** "Page x of y" at the bottom right of every page. */
function numberPages(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Page ${p} of ${total}`, w - 14, h - 8, { align: 'right' });
  }
}

export function buildEmployeeDirectoryPdf(employees: Partial<Employee>[], opts: { activeOnly: boolean; generatedAt?: Date }): jsPDF {
  const scoped = opts.activeOnly ? employees.filter((e) => e.status === 'Active') : employees;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`ABBY'S CATERERS — ${opts.activeOnly ? 'ACTIVE STAFF DIRECTORY' : 'FULL STAFF DIRECTORY'}`, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${format(opts.generatedAt ?? new Date(), 'PPP')}`, 14, 25);
  doc.text(`Total Employees: ${scoped.length}`, 14, 30);

  autoTable(doc, {
    startY: 36,
    theme: 'grid',
    head: [['ID', 'Name', 'Department', 'Role', 'Status', 'Email', 'Phone', 'Monthly Salary']],
    body: scoped.map((emp) => [
      emp.id ?? '',
      fullName(emp),
      emp.department ?? '',
      emp.role ?? '',
      emp.status ?? '',
      emp.email || '-',
      emp.phone || '-',
      emp.monthlySalary ? emp.monthlySalary.toLocaleString() : '-',
    ]),
    // 9pt keeps eight columns readable on one landscape line.
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { font: 'helvetica', fontSize: 9, fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: { 7: { halign: 'right' } },
  });
  numberPages(doc);
  return doc;
}

export const employeeDirectoryFileName = (activeOnly: boolean, on = new Date()) =>
  `employee-directory-${activeOnly ? 'active-' : ''}${format(on, 'yyyy-MM-dd')}.pdf`;

export function buildIssuanceNotePdf(entry: Issuance & { order?: Order; employee?: Employee }): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Issuance Note', 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Issue ID: ${entry.id}`, 14, 30);
  doc.text(`Date: ${entry.date}`, 14, 35);
  doc.text(`Issued To: ${entry.issuedTo}`, 150, 30);
  doc.text(`Client Order: ${entry.order?.name || 'N/A'} (${entry.orderId})`, 150, 35);

  autoTable(doc, {
    head: [['Asset Name', 'Type', 'Issued', 'Returned', 'Unit Price', 'Total Value']],
    body: entry.items.map((item) => [
      item.name,
      item.type,
      item.quantityIssued,
      item.quantityReturned || 0,
      tzs(item.unitPrice),
      tzs(item.unitPrice * item.quantityIssued),
    ]),
    startY: 45,
    foot: [[{ content: `Grand Total Value: ${tzs(entry.totalValue)}`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } }]],
    showFoot: 'lastPage',
  });

  if (entry.notes) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.text('Notes:', 14, finalY + 10);
    doc.text(entry.notes, 14, finalY + 15, { maxWidth: 180 });
  }
  numberPages(doc);
  return doc;
}
