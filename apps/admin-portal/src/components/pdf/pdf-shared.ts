// Ported verbatim from apps/catering-system/src/components/proforma-invoices/proforma-invoice-template.tsx
// and .../invoices/invoice-template.tsx, so admin-portal's exported PDFs
// match catering-system's own documents exactly rather than re-deriving
// the same numbers/strings independently.

export const COMPANY_NAME = "Abby's Legendary Caterers Limited";
export const COMPANY_TIN = '151-209-696';
export const COMPANY_VRN = '40-050290-L';

export const BANK_DETAILS = {
  accountName: "ABBY'S LEGENDARY CATERERS LIMITED",
  bank: 'Stanbic Bank Tanzania Limited',
  accountNumber: '9120002502036',
  branch: 'PENINSULA Branch',
  branchCode: '121009',
  swiftCode: 'SBICTZTX',
};

export const PROFORMA_TERMS = [
  "Purchaser's LPO or Company Purchase Order Letter must be issued.",
  'Payments shall be by Bank transfer or by Cheque.',
  'Unless otherwise agreed in writing, payments shall be made within 14 days after the invoice date.',
  'This Quote/Pro-Forma Invoice is Valid for 30days only.',
];

export function convertToWords(amount: number): string {
  if (amount < 0) return 'Negative amounts are not supported';
  if (amount === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Million', 'Billion'];

  function convertChunk(num: number): string {
    let result = '';
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    } else if (num >= 10) {
      result += teens[num - 10] + ' ';
      return result.trim();
    }
    if (num > 0) {
      result += ones[num] + ' ';
    }
    return result.trim();
  }

  let numStr = Math.floor(amount).toString();
  let chunkCount = 0;
  let result = '';
  while (numStr.length > 0) {
    const chunk = numStr.slice(-3);
    numStr = numStr.slice(0, -3);
    const chunkNum = parseInt(chunk);
    if (chunkNum !== 0) {
      let chunkWords = convertChunk(chunkNum);
      if (chunkCount > 0) {
        chunkWords += ' ' + thousands[chunkCount];
      }
      result = chunkWords + ' ' + result;
    }
    chunkCount++;
  }
  return result.trim();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
