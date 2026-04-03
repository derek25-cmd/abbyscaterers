
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CateringMenu, MenuCalculationResult } from '@/types';

/**
 * Exports a Menu Costing calculation result as a PDF document.
 */
export function exportMenuCostingPdf(
    menu: CateringMenu,
    people: number,
    useWastage: boolean,
    result: MenuCalculationResult
) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;

    // ─── Header ──────────────────────────────────────────────
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Menu Costing Report', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, y);
    y += 10;

    // ─── Menu Details ────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Menu Details', margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const details = [
        ['Menu Name', menu.name],
        ['Menu Type', (menu.menu_type_name || 'N/A').charAt(0).toUpperCase() + (menu.menu_type_name || 'n/a').slice(1)],
        ['Base People', String(menu.base_people)],
        ['Price Per Person (TZS)', Number(menu.price_per_person).toLocaleString()],
        ['Calculated For', `${people} people`],
        ['Scaling Factor', `${(people / menu.base_people).toFixed(2)}×`],
        ['Wastage Buffer', useWastage ? 'Yes (+10%)' : 'No'],
    ];

    if (menu.notes) {
        details.push(['Notes', menu.notes]);
    }

    autoTable(doc, {
        startY: y,
        head: [],
        body: details,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40 },
        },
        margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ─── Financial Summary ───────────────────────────────────
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Financial Summary', margin, y);
    y += 6;

    const financialData = [
        ['Total Ingredient Cost (TZS)', result.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })],
        ['Revenue (TZS)', result.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })],
        ['Profit (TZS)', result.profit.toLocaleString(undefined, { maximumFractionDigits: 2 })],
        ['Margin', `${result.margin}%`],
    ];

    autoTable(doc, {
        startY: y,
        head: [['Metric', 'Amount']],
        body: financialData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [51, 42, 38], textColor: [255, 255, 255] },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' },
        },
        margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ─── Planned vs Calculated Comparison ────────────────────
    if (result.plannedComparison && result.plannedComparison.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Planned vs Calculated Comparison', margin, y);
        y += 6;

        const comparisonRows = result.plannedComparison.map(row => {
            const qtyDiffStr = row.difference > 0 ? `+${row.difference.toLocaleString(undefined, { maximumFractionDigits: 2 })}` :
                               row.difference < 0 ? row.difference.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0';
            const costDiffStr = row.costDifference > 0 ? `+${row.costDifference.toLocaleString(undefined, { maximumFractionDigits: 2 })}` :
                                row.costDifference < 0 ? row.costDifference.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0';
            return [
                row.ingredient,
                row.unit,
                row.plannedQty.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                row.calculatedQty.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                qtyDiffStr,
                row.plannedCost.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                row.calculatedCost.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                costDiffStr,
            ];
        });

        // Totals
        const totalPlannedCost = result.plannedComparison.reduce((s, r) => s + r.plannedCost, 0);
        const totalCostDiff = result.totalCost - totalPlannedCost;
        const costDiffTotalStr = totalCostDiff > 0 ? `+${totalCostDiff.toLocaleString(undefined, { maximumFractionDigits: 2 })}` :
                                 totalCostDiff < 0 ? totalCostDiff.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0';
        comparisonRows.push(['TOTAL', '', '', '', '',
            totalPlannedCost.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            result.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            costDiffTotalStr,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Ingredient', 'Unit', 'Planned', 'Calculated', 'Qty Diff', 'Plan Cost (TZS)', 'Calc Cost (TZS)', 'Cost Diff (TZS)']],
            body: comparisonRows,
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [51, 42, 38], textColor: [255, 255, 255] },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right' },
            },
            margin: { left: margin, right: margin },
            didParseCell: (data: any) => {
                // Bold total row
                if (data.row.index === comparisonRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 235, 230];
                }
                // Color code differences
                if (data.column.index === 7 && data.row.index < comparisonRows.length - 1) {
                    const val = result.plannedComparison![data.row.index]?.costDifference ?? 0;
                    if (val > 0) data.cell.styles.textColor = [220, 38, 38]; // red
                    if (val < 0) data.cell.styles.textColor = [22, 163, 74]; // green
                }
            },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ─── Aggregated Ingredients Table ────────────────────────
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Aggregated Ingredients (Calculated)', margin, y);
    y += 6;

    const ingredientRows = result.ingredientsSummary.map(item => [
        item.ingredient,
        item.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        item.unit,
        item.unitCost === 0 ? 'N/A' : item.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        item.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    ]);

    // Add total row
    ingredientRows.push([
        'TOTAL', '', '', '',
        result.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Ingredient', 'Quantity', 'Unit', 'Unit Cost (TZS)', 'Total Cost (TZS)']],
        body: ingredientRows,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [51, 42, 38], textColor: [255, 255, 255] },
        columnStyles: {
            1: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        },
        margin: { left: margin, right: margin },
        // Bold total row
        didParseCell: (data: any) => {
            if (data.row.index === ingredientRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 235, 230];
            }
        },
    });

    // ─── Footer ──────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
            { align: 'center' }
        );
    }

    const filename = `${menu.name.replace(/\s+/g, '_')}_costing_${people}pax_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
}
