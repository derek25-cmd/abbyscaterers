
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Payroll, Employee } from '@/types';
import { formatTZS } from '@/lib/formatCurrency';

/**
 * Exports a single payslip as a PDF document. Direct jsPDF + autoTable
 * (no DOM/canvas capture) — a payslip is a fixed-layout document, unlike
 * invoices/proforma which are variable-length itemized lists that use the
 * html2canvas capture pattern instead. Mirrors menuCostingPdf.ts.
 */
export function exportPayslipPdf(payroll: Payroll, employee: Employee | null, companyName = "Abby's Legendary Caterers Limited") {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;

    // ─── Header ──────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, margin, y);
    y += 7;

    doc.setFontSize(13);
    doc.text('Payslip', margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Pay period: ${payroll.payPeriodStart} to ${payroll.payPeriodEnd}`, margin, y);
    y += 5;
    doc.text(`Payslip No: ${payroll.id}   |   Status: ${payroll.status}`, margin, y);
    y += 8;

    // ─── Employee details ────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Details', margin, y);
    y += 6;

    const employeeDetails = [
        ['Name', payroll.employeeName],
        ['Employee ID', payroll.employeeId],
        ['Staff Type', payroll.staff_type === 'casual' ? 'Casual' : 'Permanent'],
        ['NSSF Number', employee?.nssfNumber || 'N/A'],
        ['Bank', employee?.bankName || 'N/A'],
        ['Bank Account', employee?.bankAccountNumber || 'N/A'],
    ];

    autoTable(doc, {
        startY: y,
        head: [],
        body: employeeDetails,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ─── Earnings ────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', margin, y);
    y += 6;

    const earningsRows: string[][] = [
        ['Basic Salary', formatTZS(payroll.basicSalary)],
        ['Allowances', formatTZS(payroll.allowances)],
    ];
    if (payroll.staff_type === 'casual') {
        earningsRows.splice(0, 1, ['Basic Salary', `${formatTZS(payroll.basicSalary)}  (${payroll.days_worked ?? 0} days @ ${formatTZS(payroll.daily_rate ?? 0)})`]);
    }
    earningsRows.push(['Gross Salary', formatTZS(payroll.grossSalary)]);

    autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount']],
        body: earningsRows,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [51, 42, 38], textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: margin, right: margin },
        didParseCell: (data: any) => {
            if (data.row.index === earningsRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 235, 230];
            }
        },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ─── Deductions ──────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Deductions', margin, y);
    y += 6;

    const deductionRows = [
        ['PAYE (Income Tax)', formatTZS(payroll.paye_amount ?? 0)],
        ['NSSF (Employee)', formatTZS(payroll.nssf_employee ?? 0)],
        ['Other Deductions', formatTZS(payroll.other_deductions ?? 0)],
        ['Total Deductions', formatTZS(payroll.deductions)],
    ];

    autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount']],
        body: deductionRows,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [51, 42, 38], textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: margin, right: margin },
        didParseCell: (data: any) => {
            if (data.row.index === deductionRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 235, 230];
            }
        },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ─── Net pay ─────────────────────────────────────────────
    doc.setFillColor(51, 42, 38);
    doc.rect(margin, y, pageWidth - margin * 2, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Net Pay', margin + 3, y + 8);
    doc.text(formatTZS(payroll.netSalary), pageWidth - margin - 3, y + 8, { align: 'right' });
    y += 18;

    // ─── Employer cost footnote (informational — not part of net pay) ──
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const employerCost = payroll.grossSalary + (payroll.nssf_employer ?? 0) + (payroll.sdl_amount ?? 0) + (payroll.wcf_contrib ?? 0);
    doc.text(
        `Employer cost (not deducted from employee): NSSF employer ${formatTZS(payroll.nssf_employer ?? 0)}, SDL ${formatTZS(payroll.sdl_amount ?? 0)}, WCF ${formatTZS(payroll.wcf_contrib ?? 0)}. Total employer cost: ${formatTZS(employerCost)}.`,
        margin, y, { maxWidth: pageWidth - margin * 2 }
    );

    // ─── Footer ──────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    const filename = `Payslip_${payroll.employeeName.replace(/\s+/g, '_')}_${payroll.payPeriodStart}.pdf`;
    doc.save(filename);
}
