import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { formatTanzanianPhone } from '@/features/marketing/utils/format';
import type { CompanyImportResult, CompanyImportRowError, CompanyImportRowWarning } from '@/features/marketing/types';

export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const BUSINESS_SIZES = new Set(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']);

const COLUMN_ALIASES: Record<string, string> = {
  'company name': 'companyName',
  industry: 'industry',
  'business size': 'businessSize',
  'employee count': 'employeeCount',
  address: 'address',
  region: 'region',
  'contact name': 'contactName',
  'contact position': 'contactPosition',
  'contact phone': 'contactPhone',
  'contact email': 'contactEmail',
  'current caterer': 'currentCaterer',
  'estimated value': 'estimatedValue',
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in (value as any)) return String((value as any).text ?? '');
  if (typeof value === 'object' && 'result' in (value as any)) return String((value as any).result ?? '');
  return String(value).trim();
}

function parseEstimatedValue(raw: string): number | null {
  const cleaned = raw.replace(/TZS/gi, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export async function POST(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

  try {
    if (isCsv) {
      await workbook.csv.read(Readable.from(buffer));
    } else {
      // exceljs's bundled .d.ts declares a stray ambient `interface Buffer extends ArrayBuffer {}`,
      // which merges into and corrupts the global Buffer type, making it structurally incompatible
      // with itself at this call site (a known exceljs typings bug). `.load()` accepts a real
      // Node Buffer at runtime regardless — escape to `any` only for this call to work around it.
      await (workbook.xlsx as any).load(buffer);
    }
  } catch (error) {
    return NextResponse.json({ error: `Could not parse file: ${error instanceof Error ? error.message : 'unknown error'}` }, { status: 400 });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return NextResponse.json({ error: 'File has no data rows' }, { status: 400 });
  }
  if (sheet.rowCount - 1 > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows. Maximum is ${MAX_ROWS} per import.` }, { status: 400 });
  }

  const headerRow = sheet.getRow(1);
  const columnByIndex = new Map<number, string>();
  headerRow.eachCell((cell, colNumber) => {
    const key = cellText(cell.value).toLowerCase().trim();
    const field = COLUMN_ALIASES[key];
    if (field) columnByIndex.set(colNumber, field);
  });

  const [{ data: regions }, { data: existingCompanies }] = await Promise.all([
    client.from('regions').select('id, name'),
    client.from('companies').select('name'),
  ]);

  const regionByName = new Map((regions ?? []).map((r) => [r.name.toLowerCase(), r.id]));
  const existingNames = new Set((existingCompanies ?? []).map((c) => c.name.toLowerCase()));

  const errors: CompanyImportRowError[] = [];
  const warningDetails: CompanyImportRowWarning[] = [];
  const rowsToInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  let duplicates = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values: Record<string, string> = {};
    columnByIndex.forEach((field, colIndex) => {
      values[field] = cellText(row.getCell(colIndex).value);
    });

    const companyName = (values.companyName ?? '').trim();
    if (!companyName) {
      skipped++;
      continue;
    }

    if (existingNames.has(companyName.toLowerCase())) {
      duplicates++;
      continue;
    }

    let contactPhone: string | null = null;
    if (values.contactPhone) {
      const formatted = formatTanzanianPhone(values.contactPhone);
      if (formatted.startsWith('+255')) {
        contactPhone = formatted;
      } else {
        contactPhone = values.contactPhone;
        warningDetails.push({ row: rowNumber, companyName, field: 'Contact Phone', message: 'Invalid Tanzanian phone format — imported as-is.' });
      }
    }

    let regionId: string | null = null;
    if (values.region) {
      const match = regionByName.get(values.region.toLowerCase());
      if (match) {
        regionId = match;
      } else {
        warningDetails.push({ row: rowNumber, companyName, field: 'Region', message: `Region "${values.region}" not found — left unassigned.` });
      }
    }

    let businessSize: string | null = null;
    if (values.businessSize) {
      const upper = values.businessSize.toUpperCase();
      if (BUSINESS_SIZES.has(upper)) {
        businessSize = upper;
      } else {
        warningDetails.push({ row: rowNumber, companyName, field: 'Business Size', message: `Unrecognised size "${values.businessSize}" — left unset.` });
      }
    }

    const estimatedValue = values.estimatedValue ? parseEstimatedValue(values.estimatedValue) : null;
    const employeeCount = values.employeeCount ? Number(values.employeeCount) || null : null;

    existingNames.add(companyName.toLowerCase());
    rowsToInsert.push({
      name: companyName,
      industry: values.industry || null,
      business_size: businessSize,
      employee_count: employeeCount,
      address: values.address || null,
      region_id: regionId,
      contact_name: values.contactName || null,
      contact_position: values.contactPosition || null,
      contact_phone: contactPhone,
      contact_email: values.contactEmail || null,
      current_caterer: values.currentCaterer || null,
      estimated_value: estimatedValue,
      pipeline_stage: 'IDENTIFIED',
      lead_score: 0,
      qr_code: `ABBYS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    });
  }

  let imported = 0;
  if (rowsToInsert.length > 0) {
    const { error, count } = await client.from('companies').insert(rowsToInsert, { count: 'exact' }).select('id');
    if (error) {
      return NextResponse.json({ error: `Import failed: ${error.message}` }, { status: 500 });
    }
    imported = count ?? rowsToInsert.length;
  }

  const result: CompanyImportResult = {
    totalRows: sheet.rowCount - 1,
    imported,
    duplicates,
    skipped,
    warnings: warningDetails.length,
    errors,
    warningDetails,
  };

  return NextResponse.json({ success: true, data: result });
}
