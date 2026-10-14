import jsPDF from 'jspdf';
import type { CompanyDetails, Paragraph } from '@/lib/hr-docs/render';

/**
 * Letter PDF, drawn directly with jsPDF (not captured from the screen with
 * html2canvas), so the text stays real, selectable, searchable text. Same page
 * setup as payslipPdf.ts: A4 portrait, 14 mm margins, Helvetica.
 *
 * Layout: header (image, or a plain-text letterhead when there is no image) on
 * the first page; reference and date top right; addressee; bold subject; the
 * body; a signature block that is never split from the end of the text; and on
 * EVERY page a footer image (when set), page number and, if flagged,
 * CONFIDENTIAL.
 */

// ── Layout constants ───────────────────────────────────────────────────────
const MARGIN = 14;
const BODY_PT = 10.5;
const LINE_MM = 5.2;
const PARAGRAPH_GAP_MM = 3.2;
const MAX_HEADER_MM = 38;
const MAX_FOOTER_MM = 24;
const SIGNATURE_SPACE_MM = 20;
const MAX_IMAGE_PX = 1600;

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoadedImage {
  /** Always a PNG data URL. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface Letterhead {
  /** Printed as plain text when there is no header image. */
  company: CompanyDetails;
  header?: LoadedImage | null;
  footer?: LoadedImage | null;
  /** Only set when the template asks for the stored signature. */
  signature?: LoadedImage | null;
}

export interface LetterInput {
  letterhead: Letterhead;
  /** The real reference number, printed exactly as recorded. */
  refNo: string;
  /** Already formatted, e.g. "14 October 2026". */
  date: string;
  /** Lines of the addressee block, empty lines are skipped. */
  addressee: string[];
  subject: string;
  paragraphs: Paragraph[];
  signatory: { name: string; title: string };
  confidential: boolean;
}

// ── Images ─────────────────────────────────────────────────────────────────

/**
 * Loads an image from a URL (the app's public settings images allow
 * cross-origin reads) into a PNG data URL jsPDF can embed, downscaled if huge.
 * Throws a message HR can act on if it cannot be loaded: a letter must never go
 * out silently missing its letterhead.
 */
export async function loadImageAsDataUrl(url: string, label = 'image'): Promise<LoadedImage> {
  const fail = (why: string) =>
    new Error(`Could not load the ${label} (${why}). Check your connection and try again, or clear this image under Settings to use the plain-text letterhead.`);

  let blob: Blob;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw fail(`the server answered ${res.status}`);
    blob = await res.blob();
  } catch (err) {
    throw err instanceof Error && err.message.startsWith('Could not load') ? err : fail('the file could not be fetched');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(fail('it is not a readable image'));
      el.src = objectUrl;
    });
    const scale = Math.min(1, MAX_IMAGE_PX / img.naturalWidth);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw fail('the browser could not prepare it');
    ctx.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ── Text helpers ───────────────────────────────────────────────────────────

/**
 * jsPDF's built-in Helvetica covers Latin-1, not typographic punctuation.
 * Word and phone keyboards produce curly quotes and long dashes constantly, so
 * map them to plain equivalents instead of printing garbage.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/•/g, '-')
    .replace(/[​-‍﻿]/g, '');
}

interface Word { text: string; bold: boolean; width: number }
type Line = Word[];

/** Wraps mixed plain/bold runs into lines no wider than maxWidth. */
function layoutParagraph(doc: jsPDF, paragraph: Paragraph, maxWidth: number): Line[] {
  const lines: Line[] = [[]];
  let x = 0;

  const measure = (text: string, bold: boolean) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    return doc.getTextWidth(text);
  };

  for (const segment of paragraph) {
    const text = pdfSafe(segment.text);
    // Tokens are words, runs of spaces, or a line break.
    for (const token of text.split(/(\n|[ \t]+)/)) {
      if (token === '') continue;
      if (token === '\n') { lines.push([]); x = 0; continue; }

      const isSpace = /^[ \t]+$/.test(token);
      const piece = isSpace ? ' ' : token;
      const width = measure(piece, segment.bold);

      if (isSpace) {
        if (x > 0) { lines[lines.length - 1].push({ text: ' ', bold: segment.bold, width }); x += width; }
        continue;
      }
      if (x + width > maxWidth && x > 0) {
        // Drop the space that would trail the line, then wrap.
        const last = lines[lines.length - 1];
        if (last.length && last[last.length - 1].text === ' ') last.pop();
        lines.push([]); x = 0;
      }
      if (width > maxWidth) {
        // A single word wider than the page (a long URL): break it by characters.
        let chunk = '';
        for (const ch of piece) {
          if (measure(chunk + ch, segment.bold) > maxWidth && chunk) {
            lines[lines.length - 1].push({ text: chunk, bold: segment.bold, width: measure(chunk, segment.bold) });
            lines.push([]); chunk = '';
          }
          chunk += ch;
        }
        const w = measure(chunk, segment.bold);
        lines[lines.length - 1].push({ text: chunk, bold: segment.bold, width: w });
        x = w;
        continue;
      }
      lines[lines.length - 1].push({ text: piece, bold: segment.bold, width });
      x += width;
    }
  }
  return lines;
}

// ── The document ───────────────────────────────────────────────────────────

function imageHeightMm(img: LoadedImage, widthMm: number, maxMm: number): { w: number; h: number } {
  let w = widthMm;
  let h = (img.height / img.width) * w;
  if (h > maxMm) { h = maxMm; w = (img.width / img.height) * h; }
  return { w, h };
}

/** Builds the letter and returns the jsPDF document (tests and callers can inspect pages). */
export function buildLetterDoc(input: LetterInput): jsPDF {
  const { letterhead, refNo, date, addressee, subject, paragraphs, signatory, confidential } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

  // Footer band reserved on every page: footer image + the CONFIDENTIAL/page row.
  const footerImg = letterhead.footer ? imageHeightMm(letterhead.footer, contentW, MAX_FOOTER_MM) : null;
  const footerRowMm = 6;
  const footerBand = (footerImg ? footerImg.h + 2 : 0) + footerRowMm;
  const bottomLimit = pageH - MARGIN - footerBand;

  let y = MARGIN;

  // ── Header (first page only) ─────────────────────────────────────────────
  if (letterhead.header) {
    const { w, h } = imageHeightMm(letterhead.header, contentW, MAX_HEADER_MM);
    doc.addImage(letterhead.header.dataUrl, 'PNG', MARGIN + (contentW - w) / 2, y, w, h, 'letter-header');
    y += h + 6;
  } else {
    const c = letterhead.company;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(pdfSafe(c.name || ''), pageW / 2, y + 4, { align: 'center' });
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    const contact = [c.phone && `Tel: ${c.phone}`, c.email && `Email: ${c.email}`].filter(Boolean).join('   |   ');
    const tax = [c.tin && `TIN: ${c.tin}`, c.vrn && `VRN: ${c.vrn}`].filter(Boolean).join('   |   ');
    const lines = [...(c.address ? c.address.split(/\r?\n/) : []), contact, tax].map((l) => (l || '').trim()).filter(Boolean);
    for (const l of lines) { doc.text(pdfSafe(l), pageW / 2, y, { align: 'center' }); y += 4; }
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y + 1, pageW - MARGIN, y + 1);
    y += 7;
    doc.setTextColor(0, 0, 0);
  }

  const ensure = (needed: number) => {
    if (y + needed > bottomLimit) { doc.addPage(); y = MARGIN; }
  };

  // ── Reference and date, top right ────────────────────────────────────────
  doc.setFontSize(BODY_PT);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ref: ${pdfSafe(refNo)}`, pageW - MARGIN, y, { align: 'right' });
  y += LINE_MM;
  doc.text(`Date: ${pdfSafe(date)}`, pageW - MARGIN, y, { align: 'right' });
  y += LINE_MM + 4;

  // ── Addressee ────────────────────────────────────────────────────────────
  for (const line of addressee.map((l) => l.trim()).filter(Boolean)) {
    ensure(LINE_MM);
    doc.setFont('helvetica', 'normal');
    doc.text(pdfSafe(line), MARGIN, y);
    y += LINE_MM;
  }
  y += 4;

  // ── Subject ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_PT + 0.5);
  for (const l of doc.splitTextToSize(pdfSafe(subject), contentW) as string[]) {
    ensure(LINE_MM);
    doc.text(l, MARGIN, y);
    y += LINE_MM;
  }
  y += PARAGRAPH_GAP_MM;

  // ── Body ─────────────────────────────────────────────────────────────────
  doc.setFontSize(BODY_PT);
  for (const paragraph of paragraphs) {
    for (const line of layoutParagraph(doc, paragraph, contentW)) {
      ensure(LINE_MM);
      let x = MARGIN;
      for (const word of line) {
        if (word.text === ' ') { x += word.width; continue; }
        doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
        doc.text(word.text, x, y);
        x += word.width;
      }
      y += LINE_MM;
    }
    y += PARAGRAPH_GAP_MM;
  }

  // ── Signature block: kept together, and with at least a line of text above it ─
  const sigImg = letterhead.signature ? imageHeightMm(letterhead.signature, 45, SIGNATURE_SPACE_MM) : null;
  const blockH = LINE_MM + 2 + SIGNATURE_SPACE_MM + 2 + LINE_MM * 2;
  ensure(blockH + 2);
  doc.setFont('helvetica', 'normal');
  doc.text('Yours sincerely,', MARGIN, y + LINE_MM);
  y += LINE_MM + 2;
  if (sigImg && letterhead.signature) {
    doc.addImage(letterhead.signature.dataUrl, 'PNG', MARGIN, y, sigImg.w, sigImg.h, 'letter-signature');
  }
  y += SIGNATURE_SPACE_MM;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 60, y);
  y += LINE_MM;
  doc.setFont('helvetica', 'bold');
  doc.text(pdfSafe(signatory.name), MARGIN, y);
  y += LINE_MM;
  doc.setFont('helvetica', 'normal');
  doc.text(pdfSafe(signatory.title), MARGIN, y);

  // ── Footer on every page ─────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    let fy = pageH - MARGIN;
    if (footerImg && letterhead.footer) {
      fy -= footerImg.h;
      doc.addImage(letterhead.footer.dataUrl, 'PNG', MARGIN + (contentW - footerImg.w) / 2, fy, footerImg.w, footerImg.h, 'letter-footer');
      fy -= 2;
    }
    doc.setFontSize(8);
    if (confidential) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150, 0, 0);
      doc.text('CONFIDENTIAL', MARGIN, fy - 1);
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${page} of ${total}`, pageW - MARGIN, fy - 1, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

export async function buildLetterPdf(input: LetterInput): Promise<Blob> {
  return buildLetterDoc(input).output('blob');
}

// ── Integrity ──────────────────────────────────────────────────────────────

/** SHA-256 of a file's exact bytes, as lowercase hex. */
export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
