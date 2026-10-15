import { cn } from '@/lib/utils';
import type { LetterSettings, RenderedLetter } from '@/services/hrDocumentService';

interface LetterPreviewProps {
  rendered: Pick<RenderedLetter, 'subject' | 'addressee' | 'paragraphs'>;
  /** The real number, or the "assigned when issued" marker. */
  refNo: string;
  /** Already formatted, e.g. 14 October 2026. */
  date: string;
  settings: Pick<LetterSettings, 'company' | 'headerUrl' | 'footerUrl'> & Partial<Pick<LetterSettings, 'signatureUrl' | 'stampUrl'>>;
  signatory: { name: string; title: string };
  confidential: boolean;
  className?: string;
}

/**
 * The letter as it will print, on a sheet of paper. It follows the PDF layout
 * (header, ref and date top right, addressee, bold subject, body, signature
 * block, footer) but is HTML for the screen: the PDF itself is built separately.
 */
export function LetterPreview({ rendered, refNo, date, settings, signatory, confidential, className }: LetterPreviewProps) {
  const c = settings.company;
  const address = (c.address ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const contact = [c.phone && `Tel: ${c.phone}`, c.email && `Email: ${c.email}`].filter(Boolean).join('   |   ');
  const tax = [c.tin && `TIN: ${c.tin}`, c.vrn && `VRN: ${c.vrn}`].filter(Boolean).join('   |   ');

  return (
    <div className={cn('mx-auto w-full max-w-[794px] rounded-sm border bg-white p-8 text-[13px] leading-relaxed text-black shadow-md', className)}>
      {settings.headerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.headerUrl} alt="Letterhead" className="mx-auto mb-4 max-h-28 w-auto object-contain" />
      ) : (
        <div className="mb-4 border-b-2 border-gray-700 pb-3 text-center">
          <p className="text-lg font-bold">{c.name || 'Company name'}</p>
          {address.map((l) => <p key={l} className="text-[11px] text-gray-600">{l}</p>)}
          {contact && <p className="text-[11px] text-gray-600">{contact}</p>}
          {tax && <p className="text-[11px] text-gray-600">{tax}</p>}
        </div>
      )}

      <div className="mb-4 text-right">
        <p>Ref: {refNo}</p>
        <p>Date: {date}</p>
      </div>

      <div className="mb-4">
        {rendered.addressee.map((l, i) => <p key={`${i}-${l}`}>{l}</p>)}
      </div>

      <p className="mb-3 font-bold">{rendered.subject}</p>

      <div className="space-y-3">
        {rendered.paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p.map((s, j) => (s.bold ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>))}
          </p>
        ))}
      </div>

      <div className="mt-6">
        <p>Yours sincerely,</p>
        {/* Same signature and stamp as the invoices, as the PDF prints them. */}
        <div className="relative">
          <div className="flex h-12 items-end">
            {settings.signatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.signatureUrl} alt="Signature" className="max-h-12 w-auto object-contain mix-blend-multiply" />
            )}
          </div>
          {settings.stampUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.stampUrl} alt="Stamp" className="absolute left-60 top-0 h-28 w-28 object-contain mix-blend-multiply" />
          )}
          <div className="w-56 border-t border-black pt-1">
            <p className="font-bold">{signatory.name}</p>
            <p>{signatory.title}</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {settings.footerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.footerUrl} alt="" className="mx-auto max-h-16 w-auto object-contain" />
        )}
        {confidential && <p className="mt-1 text-[10px] font-bold text-red-900">CONFIDENTIAL</p>}
      </div>
    </div>
  );
}
