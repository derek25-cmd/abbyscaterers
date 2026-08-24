import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Ported from apps/catering-system/src/app/proforma-invoices/[id]/proforma-invoice-view-page-component.tsx's
// handleExportAction — the single-document path only (no "bundle"
// proforma+invoice-in-one-PDF mode, no interactive header/footer toggles
// dialog; admin-portal just needs one "Export PDF" button that always
// shows header/footer). Same pagination technique: capture header/content/
// footer separately at a fixed render width so font size doesn't depend on
// the viewer's window width, then slice the content across A4 pages,
// pulling the cut point earlier if it would land inside a
// data-pdf-no-break element (signature block, amount-in-words).
export async function exportDocumentToPdf(options: {
  cardId: string;
  headerId: string;
  contentId: string;
  footerId: string;
  pdfScale: number;
  filename: string;
}) {
  const { cardId, headerId, contentId, footerId, pdfScale, filename } = options;

  const CARD_RENDER_WIDTH = 880;
  const TARGET_CANVAS_WIDTH = CARD_RENDER_WIDTH * pdfScale;

  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 30;
  const headerTopY = 8;
  const headerGap = 1;
  const marginBottom = 5;
  const usableWidth = pageWidth - marginX * 2;

  const headerElement = document.getElementById(headerId);
  const contentElement = document.getElementById(contentId);
  const footerElement = document.getElementById(footerId);
  if (!headerElement || !contentElement || !footerElement) {
    throw new Error('Could not find the document elements to export');
  }

  const cardElement = document.getElementById(cardId);
  const savedCardStyle = cardElement ? cardElement.style.cssText : '';
  if (cardElement) {
    cardElement.style.width = `${CARD_RENDER_WIDTH}px`;
    cardElement.style.minWidth = `${CARD_RENDER_WIDTH}px`;
    cardElement.style.maxWidth = `${CARD_RENDER_WIDTH}px`;
    cardElement.style.boxSizing = 'border-box';
    await new Promise((res) => setTimeout(res, 50));
  }

  const scale = TARGET_CANVAS_WIDTH / Math.max(contentElement.scrollWidth, 1);
  const canvasOpts = { scale, useCORS: true, logging: false, allowTaint: true };

  const headerHasHeight = headerElement.getBoundingClientRect().height > 0;
  const footerHasHeight = footerElement.getBoundingClientRect().height > 0;

  const headerCanvas = headerHasHeight ? await html2canvas(headerElement, canvasOpts) : null;
  const contentCanvas = await html2canvas(contentElement, canvasOpts);
  const footerCanvas = footerHasHeight ? await html2canvas(footerElement, canvasOpts) : null;

  if (cardElement) cardElement.style.cssText = savedCardStyle;

  const headerHeight = headerCanvas && headerCanvas.width > 0 ? 96 : 0;
  const footerHeight = footerCanvas && footerCanvas.width > 0 ? (footerCanvas.height * usableWidth) / footerCanvas.width : 0;
  const contentTopY = headerTopY + headerHeight + headerGap;
  const usableContentHeight = Math.max(1, pageHeight - contentTopY - footerHeight - marginBottom);

  const contentImgHeight = (contentCanvas.height * usableWidth) / contentCanvas.width;

  const headerDataURL = headerCanvas && headerCanvas.width > 0 ? headerCanvas.toDataURL('image/jpeg', 0.92) : null;
  const footerDataURL = footerCanvas && footerCanvas.width > 0 ? footerCanvas.toDataURL('image/jpeg', 0.92) : null;

  const contentCssHeight = contentElement.getBoundingClientRect().height;
  const contentTop = contentElement.getBoundingClientRect().top;
  const pdfPerCssPx = contentCssHeight > 0 ? contentImgHeight / contentCssHeight : 1;
  const noBreakRanges = Array.from(contentElement.querySelectorAll('[data-pdf-no-break="true"]'))
    .map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { top: (r.top - contentTop) * pdfPerCssPx, bottom: (r.bottom - contentTop) * pdfPerCssPx };
    })
    .sort((a, b) => a.top - b.top);

  let yOffset = 0;
  let pageNumber = 1;

  while (yOffset < contentImgHeight) {
    if (pageNumber > 1) pdf.addPage();

    if (headerDataURL && headerHeight > 0) {
      pdf.addImage(headerDataURL, 'JPEG', marginX, headerTopY, usableWidth, headerHeight);
    }

    const naiveEnd = yOffset + usableContentHeight;
    let safeEnd = naiveEnd;
    for (const range of noBreakRanges) {
      if (range.top < naiveEnd && range.bottom > naiveEnd) {
        if (range.top > yOffset + 20) safeEnd = range.top;
        break;
      }
    }

    const sliceHeight = Math.min(safeEnd - yOffset, contentImgHeight - yOffset);

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = contentCanvas.width;
    sliceCanvas.height = Math.max(1, Math.ceil((sliceHeight / usableWidth) * contentCanvas.width));
    const sliceCtx = sliceCanvas.getContext('2d');

    if (sliceCtx && sliceHeight > 0) {
      sliceCtx.drawImage(
        contentCanvas,
        0,
        (yOffset / usableWidth) * contentCanvas.width,
        contentCanvas.width,
        sliceCanvas.height,
        0,
        0,
        sliceCanvas.width,
        sliceCanvas.height
      );
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', marginX, contentTopY, usableWidth, sliceHeight);
    }

    if (footerDataURL && footerHeight > 0) {
      pdf.addImage(footerDataURL, 'JPEG', marginX, pageHeight - footerHeight - marginBottom, usableWidth, footerHeight);
    }

    yOffset += sliceHeight;
    pageNumber++;
  }

  pdf.save(filename);
}
