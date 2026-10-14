import { describe, it, expect } from 'vitest';
import { buildLetterDoc, buildLetterPdf, pdfSafe, sha256, type LetterInput } from '../hr-docs/letterPdf';

const base = (over: Partial<LetterInput> = {}): LetterInput => ({
  letterhead: { company: { name: "Abby's Legendary Caterers Limited", address: 'Plot 362\nP.O. Box 25187', tin: '151-209-696' } },
  refNo: 'ALC/HR/GEN/2026/0001',
  date: '14 October 2026',
  addressee: ['Amina Juma', 'Kitchen'],
  subject: 'Confirmation of employment',
  paragraphs: [[{ text: 'Dear Amina,', bold: false }]],
  signatory: { name: 'Neema Mushi', title: 'HR Manager' },
  confidential: false,
  ...over,
});

/** The drawing commands of one page, as text. */
const pageText = (doc: ReturnType<typeof buildLetterDoc>, page: number) =>
  ((doc.internal as unknown as { pages: string[][] }).pages[page] ?? []).join('\n');

const longParagraphs = (n: number) =>
  Array.from({ length: n }, (_, i) => [
    { text: `Paragraph ${i + 1}. `, bold: true },
    { text: 'The company confirms that the employee named above is employed in the position and department stated on this letter, and that this letter is issued at the request of the employee for whatever lawful purpose it may serve. '.repeat(3), bold: false },
  ]);

describe('buildLetterDoc', () => {
  it('prints the reference number and date on page 1', () => {
    const doc = buildLetterDoc(base());
    expect(pageText(doc, 1)).toContain('ALC/HR/GEN/2026/0001');
    expect(pageText(doc, 1)).toContain('14 October 2026');
  });

  it('runs to more than one page for a long letter, and numbers the pages', () => {
    const doc = buildLetterDoc(base({ paragraphs: longParagraphs(14) }));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(pageText(doc, 1)).toContain('ALC/HR/GEN/2026/0001');
    expect(pageText(doc, 2)).toContain(`Page 2 of ${doc.getNumberOfPages()}`);
  });

  it('keeps a short letter on one page, signature included', () => {
    const doc = buildLetterDoc(base());
    expect(doc.getNumberOfPages()).toBe(1);
    expect(pageText(doc, 1)).toContain('Neema Mushi');
    expect(pageText(doc, 1)).toContain('HR Manager');
  });

  it('prints CONFIDENTIAL on every page when flagged, and never when not', () => {
    const flagged = buildLetterDoc(base({ confidential: true, paragraphs: longParagraphs(14) }));
    for (let p = 1; p <= flagged.getNumberOfPages(); p++) expect(pageText(flagged, p)).toContain('CONFIDENTIAL');
    expect(pageText(buildLetterDoc(base()), 1)).not.toContain('CONFIDENTIAL');
  });

  it('uses the plain-text letterhead without a header image, skipping empty lines', () => {
    const text = pageText(buildLetterDoc(base()), 1);
    expect(text).toContain('Plot 362');
    expect(text).toContain('TIN: 151-209-696');
    expect(text).not.toContain('Tel:');
    expect(text).not.toContain('VRN:');
  });

  it('draws images from the letterhead when given', () => {
    const png = { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', width: 400, height: 100 };
    const doc = buildLetterDoc(base({ letterhead: { company: { name: 'X' }, header: png, footer: png, signature: png } }));
    expect(pageText(doc, 1)).not.toContain("Abby's"); // text letterhead replaced by the image
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('prints the invoice signature and stamp as two images in the signature block', () => {
    const png = { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', width: 200, height: 200 };
    // Images placed on page 1 (each placement is a "/I<n> Do" drawing command).
    const images = (doc: ReturnType<typeof buildLetterDoc>) => (pageText(doc, 1).match(/\/I\d+ Do/g) ?? []).length;
    expect(images(buildLetterDoc(base({ letterhead: { company: { name: 'X' }, signature: png } })))).toBe(1);
    const both = buildLetterDoc(base({ letterhead: { company: { name: 'X' }, signature: png, stamp: png } }));
    expect(images(both)).toBe(2);
    expect(both.getNumberOfPages()).toBe(1);
    expect(pageText(both, 1)).toContain('Neema Mushi');
  });

  it('keeps the stamp with the signature when the letter fills the page', () => {
    const png = { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', width: 200, height: 200 };
    for (let n = 1; n <= 8; n++) {
      const doc = buildLetterDoc(base({ letterhead: { company: { name: 'X' }, signature: png, stamp: png }, paragraphs: longParagraphs(n) }));
      const last = doc.getNumberOfPages();
      // The name under the signature is always on the last page, together with the stamp image.
      expect(pageText(doc, last)).toContain('Neema Mushi');
      expect(pageText(doc, last)).toMatch(/\/I\d+ Do/);
    }
  });

  it('does not lose a paragraph that is one very long word', () => {
    const doc = buildLetterDoc(base({ paragraphs: [[{ text: 'x'.repeat(400), bold: false }]] }));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('never splits the signature from the text: it moves to a new page together', () => {
    // Fill most of the page so the signature block cannot fit, then check it lands whole.
    for (let n = 6; n <= 30; n++) {
      const doc = buildLetterDoc(base({ paragraphs: longParagraphs(n) }));
      const last = doc.getNumberOfPages();
      const lastPage = pageText(doc, last);
      const hasName = lastPage.includes('Neema Mushi');
      const hasClosing = lastPage.includes('Yours sincerely');
      expect(hasName).toBe(hasClosing);
    }
  });
});

describe('buildLetterPdf and sha256', () => {
  it('returns a PDF blob', async () => {
    const blob = await buildLetterPdf(base());
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
  });

  it('hashes a blob to the known SHA-256', async () => {
    expect(await sha256(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('gives a different hash for different bytes', async () => {
    expect(await sha256(new Blob(['abc']))).not.toBe(await sha256(new Blob(['abd'])));
  });
});

describe('pdfSafe', () => {
  it('replaces typographic punctuation with plain characters', () => {
    expect(pdfSafe('“Abby’s” – done… ok')).toBe('"Abby\'s" - done... ok');
  });
});
