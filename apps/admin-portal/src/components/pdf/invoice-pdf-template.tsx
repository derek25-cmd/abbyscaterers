'use client';

import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { BANK_DETAILS, COMPANY_NAME, COMPANY_TIN, COMPANY_VRN, convertToWords, formatCurrency } from './pdf-shared';
import type { PdfItem } from './proforma-pdf-template';
import type { AppSettings } from '@/lib/use-app-settings';

export interface InvoicePdfData {
  id: string;
  invoiceDate: string;
  receiverName?: string | null;
  receiverPosition?: string | null;
  lpoNumber?: string | null;
  clientCompanyName?: string | null;
  clientAddress1?: string | null;
  clientAddress2?: string | null;
  serviceDesc?: string | null;
  proformaId?: string | null;
  appendProformaId?: boolean | null;
  serviceCharge: number;
  transportCosts: number;
  multiplyByDays?: boolean | null;
  numberOfDays?: number | null;
  vatType: 'inclusive' | 'exclusive';
  signedAtDate?: string | null;
  signedAtLocation?: string | null;
  items: PdfItem[];
}

const formatDate = (dateStr?: string) => {
  if (!dateStr || !isValid(parseISO(dateStr))) return '{Date}';
  return format(parseISO(dateStr), 'do MMMM yyyy');
};

const getParticularText = (item: PdfItem): string =>
  `${item.mealType || item.eventType || '{Particular}'}${item.date ? ` on ${format(parseISO(item.date), 'PPP')}` : ''}`;

// Mirrors apps/catering-system/src/components/invoices/invoice-template.tsx
// layout and math exactly — see proforma-pdf-template.tsx's header comment
// for why this deliberately doesn't "correct" the VAT display for
// inclusive-type documents.
export function InvoicePdfTemplate({ data, settings }: { data: InvoicePdfData; settings: AppSettings }) {
  const {
    id, invoiceDate, receiverName, receiverPosition, lpoNumber, serviceCharge, transportCosts,
    multiplyByDays, numberOfDays, vatType, items, signedAtDate, signedAtLocation,
  } = data;

  let serviceDescription = data.serviceDesc || '';
  if (data.appendProformaId && data.proformaId) {
    serviceDescription += ` **as per Pro-Forma Invoice No. ${data.proformaId}**`;
  }
  if (serviceDescription.startsWith('Provision of')) {
    serviceDescription = serviceDescription.replace('Provision of', 'Being Costs of');
  } else if (!serviceDescription.startsWith('Being Costs of')) {
    serviceDescription = `Being Costs of ${serviceDescription}`;
  }

  const showingCustom = useMemo(
    () => items.some((item) => !item.orderId) && items.some((item) => !!item.orderId),
    [items]
  );

  const sortedItems = useMemo(() => {
    const itemsToDisplay = showingCustom ? items.filter((item) => !item.orderId) : items;
    return [...itemsToDisplay].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return parseISO(a.date).getTime() - parseISO(b.date).getTime();
    });
  }, [items, showingCustom]);

  const subtotal = sortedItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalForDays = multiplyByDays ? subtotal * (numberOfDays || 1) : subtotal;
  const totalBeforeVat = totalForDays + (serviceCharge || 0) + (transportCosts || 0);
  const vat = vatType === 'exclusive' ? totalBeforeVat * 0.18 : 0;
  const grandTotal = totalBeforeVat + vat;

  return (
    <div style={{ marginLeft: '1cm', marginRight: '0.8cm' }}>
      <div id="invoice-pdf-content" className="p-8 bg-white text-black" style={{ fontFamily: 'sans-serif', fontSize: '15px' }}>
        <div id="invoice-header">
          {settings.headerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.headerUrl} alt="Header" style={{ width: '100%', display: 'block' }} />
          )}
        </div>

        <div id="invoice-main-content">
          <div className="text-right relative z-10" style={{ marginTop: '-16px' }}>
            <h2 className="font-extrabold text-4xl" style={{ color: '#800020' }}>INVOICE</h2>
            <div className="mt-1 text-base space-y-0">
              <p><strong>Date:</strong> {formatDate(invoiceDate)}</p>
              <p><strong>Invoice No.:</strong> {id || '{Invoice No.}'}</p>
            </div>
          </div>
          <div className="flex justify-between items-end mb-1">
            <div className="flex-1">
              <div className="text-base">
                <p className="mb-1"><strong>To:</strong></p>
                {receiverName && <p className="mb-1 ml-6">{receiverName}</p>}
                {receiverPosition && <p className="mb-1 ml-6">{receiverPosition}</p>}
                {data.clientCompanyName && <p className="mb-1 ml-6">{data.clientCompanyName}</p>}
                {data.clientAddress1 && <p className="mb-1 ml-6">{data.clientAddress1}</p>}
                {data.clientAddress2 && <p className="mb-1 ml-6">{data.clientAddress2}</p>}
                {lpoNumber && <p className="mb-2 ml-6 pt-2 font-bold text-lg">LPO No.: {lpoNumber}</p>}
              </div>
            </div>
            <div style={{ width: 220, position: 'relative', zIndex: 10 }}>
              <div className="border border-gray-800 flex flex-col items-center justify-center text-sm p-2 bg-white shadow-sm text-center">
                <div><strong>TIN: {COMPANY_TIN}</strong></div>
                <div><strong>VRN: {COMPANY_VRN}</strong></div>
              </div>
            </div>
          </div>
          <hr className="border-t-2 border-gray-800" style={{ marginTop: '5px' }} />
          <div className="mb-1 text-center text-base italic px-4" style={{ marginTop: 0, paddingTop: '2px', paddingBottom: '2px' }}>
            <p dangerouslySetInnerHTML={{ __html: serviceDescription.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
          </div>

          <table className="w-full border-collapse border border-gray-800 text-sm" style={{ tableLayout: 'fixed', borderWidth: '1px' }}>
            <thead>
              <tr style={{ fontWeight: 'bold' }} className="text-center bg-gray-200">
                <th className="border border-gray-800 py-1 px-1" style={{ width: '5%', borderWidth: '1px' }}>S/No.</th>
                <th className="border border-gray-800 py-1 px-1" style={{ width: '5%', borderWidth: '1px' }}>QTY</th>
                {!showingCustom && (
                  <th className="border border-gray-800 py-1 px-1" style={{ width: '10%', borderWidth: '1px' }}>Order ID</th>
                )}
                <th className="border border-gray-800 py-1 px-2 text-left" style={{ width: showingCustom ? '50%' : '40%', borderWidth: '1px' }}>PARTICULARS</th>
                <th className="border border-gray-800 py-1 px-2 text-right" style={{ width: '25%', borderWidth: '1px' }}>UNIT PRICE (TSHS)</th>
                <th className="border border-gray-800 py-1 px-2 text-right" style={{ width: '15%', borderWidth: '1px' }}>TOTAL (TSHS)</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-black py-1 px-1 text-center" style={{ borderWidth: '1px' }}>{index + 1}</td>
                  <td className="border border-black py-1 px-1 text-center" style={{ borderWidth: '1px' }}>{item.pax || '{pax}'}</td>
                  {!showingCustom && (
                    <td className="border border-black py-1 px-1 text-center font-mono text-xs" style={{ borderWidth: '1px' }}>{item.id}</td>
                  )}
                  <td className="border border-black py-1 px-2 text-left" style={{ borderWidth: '1px' }}>
                    <span className="leading-snug">{item.particularDescription || getParticularText(item)}</span>
                  </td>
                  <td className="border border-black py-1 px-2 text-right" style={{ borderWidth: '1px' }}>{item.unitPrice ? formatCurrency(item.unitPrice) : '{UnitPrice}'}</td>
                  <td className="border border-black py-1 px-2 text-right" style={{ borderWidth: '1px' }}>{item.total ? formatCurrency(item.total) : '{Total}'}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={showingCustom ? 3 : 4} rowSpan={8} className="p-2 align-top border" style={{ borderWidth: '1px' }} />
                <td className="py-1 px-2 text-right font-semibold border" style={{ borderWidth: '1px' }}>Sub-Total (TSHS)</td>
                <td className="py-1 px-2 text-right font-semibold border" style={{ borderWidth: '1px' }}>{formatCurrency(subtotal)}</td>
              </tr>
              {multiplyByDays && (
                <>
                  <tr>
                    <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>No of days</td>
                    <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>{numberOfDays || 1}</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 text-right font-bold border" style={{ borderWidth: '1px', background: 'rgba(0,0,0,0.05)' }}>TOTAL (TSHS)</td>
                    <td className="py-1 px-2 text-right font-bold border" style={{ borderWidth: '1px', background: 'rgba(0,0,0,0.05)' }}>{formatCurrency(totalForDays)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>Add Service Charge (TSHS)</td>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>{serviceCharge > 0 ? formatCurrency(serviceCharge) : '0.00'}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>Add Transportation Costs (TSHS)</td>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>{transportCosts > 0 ? formatCurrency(transportCosts) : '0.00'}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>Total Before VAT (TSHS)</td>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>{formatCurrency(totalBeforeVat)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>Add VAT 18% (TSHS)</td>
                <td className="py-1 px-2 text-right border" style={{ borderWidth: '1px' }}>{vat > 0 ? formatCurrency(vat) : 'Inclusive'}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-right font-bold border" style={{ borderWidth: '1px', background: 'rgba(0,0,0,0.08)' }}>GRAND TOTAL (TSHS)</td>
                <td className="py-1 px-2 text-right font-bold border" style={{ borderWidth: '1px', background: 'rgba(0,0,0,0.08)' }}>{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div data-pdf-no-break="true" className="text-right mb-2 text-base px-2 pb-2 bg-white rounded">
            <span className="font-bold">Amount in Words:</span>{' '}
            <span className="italic">Tanzania Shillings {convertToWords(grandTotal)} only.</span>
          </div>

          <div data-pdf-no-break="true" className="flex gap-4 mt-6 mb-4 items-stretch">
            <div className="flex-1 border border-gray-800 p-3" style={{ fontSize: '14px' }}>
              <p className="font-bold mb-1">Please remit your payment to the below Bank details:</p>
              <div className="grid grid-cols-[max-content_auto] gap-x-2 gap-y-0" style={{ fontSize: '14px' }}>
                <div>Account Name</div><div>: {BANK_DETAILS.accountName}</div>
                <div>Bank</div><div>: {BANK_DETAILS.bank}</div>
                <div>Account Number(TZS)</div><div>: {BANK_DETAILS.accountNumber}</div>
                <div>Branch</div><div>: {BANK_DETAILS.branch}</div>
                <div>Branch Code</div><div>: {BANK_DETAILS.branchCode}</div>
                <div>Swift Code</div><div>: {BANK_DETAILS.swiftCode}</div>
              </div>
              <p className="font-bold mt-3 pt-2 text-center uppercase tracking-wide border-t border-gray-400" style={{ fontSize: '10px' }}>
                We will issue EFD receipt once payment is received
              </p>
            </div>
            <div className="border border-gray-800 p-3 text-center" style={{ fontSize: '14px', minWidth: '220px', position: 'relative' }}>
              {settings.invoiceStampUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Stamp"
                  src={settings.invoiceStampUrl}
                  style={{ position: 'absolute', bottom: '18px', right: '4px', width: '120px', height: '120px', objectFit: 'contain', mixBlendMode: 'multiply', zIndex: 10 }}
                />
              )}
              <p className="mb-2 text-left" style={{ fontSize: '13px' }}>
                Signed at {signedAtLocation || 'Dar es Salaam'} on this{' '}
                {signedAtDate ? format(parseISO(signedAtDate), 'do') : '___'} day of{' '}
                {signedAtDate ? format(parseISO(signedAtDate), 'MMMM yyyy') : '_________ ________'}
              </p>
              <p className="mb-1">For and on behalf of:-</p>
              <p className="mb-1 font-semibold" style={{ fontSize: '14px' }}>{COMPANY_NAME}</p>
              {settings.signatureUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Signature"
                  src={settings.signatureUrl}
                  className="block mx-auto"
                  style={{ maxWidth: '100%', maxHeight: '65px', width: 'auto', height: 'auto', mixBlendMode: 'multiply', position: 'relative', zIndex: 2 }}
                />
              )}
              <p style={{ marginTop: settings.signatureUrl ? '-10px' : '30px', fontSize: '14px', position: 'relative', zIndex: 1 }}>
                Signature: ___________________
              </p>
            </div>
          </div>
        </div>

        <div id="invoice-footer" className="pb-6">
          {settings.footerUrl && (
            <div className="mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.footerUrl} alt="Footer" style={{ width: '100%', display: 'block' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
