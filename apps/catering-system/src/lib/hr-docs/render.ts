import { formatTZS } from '@/lib/formatCurrency';
import type { Employee } from '@/types';

/**
 * Letter template renderer.
 *
 * A template is plain text with three features and nothing else (no logic, no
 * HTML, so a template can never do anything but print words):
 *   {{path.to.field}}   a value filled in from the document, inside a sentence
 *   {{{path.to.field}}} on a line of its own: a whole block of text written by
 *                       the author (several paragraphs, **bold** and {{fields}}
 *                       allowed), as used for the body of a general letter
 *   **bold**            bold text
 * Paragraphs are separated by a blank line; a single line break stays a line break.
 *
 * Callers MUST refuse to submit or issue while `missing` is not empty: a
 * placeholder that cannot be filled prints as blank, and a letter with a hole in
 * it must never go out.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Segment { text: string; bold: boolean }
/** One paragraph is a run of plain and bold segments. */
export type Paragraph = Segment[];

export interface RenderResult {
  paragraphs: Paragraph[];
  /** Placeholder paths that had no value, in the order they first appear. */
  missing: string[];
}

export type RenderContext = Record<string, unknown>;

export interface CompanyDetails {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tin?: string | null;
  vrn?: string | null;
}

// ── Rendering ──────────────────────────────────────────────────────────────

// {{x}} and, when it is not on a line of its own, {{{x}}} (treated like {{x}}).
const PLACEHOLDER = /\{\{\{?\s*([A-Za-z_][\w]*(?:\.[\w]+)*)\s*\}?\}\}/g;
const BLOCK_PLACEHOLDER = /^\{\{\{\s*([A-Za-z_][\w]*(?:\.[\w]+)*)\s*\}\}\}$/;
const PARAGRAPH_BREAK = /\r?\n[ \t]*\r?\n/;

function lookup(context: RenderContext, path: string): string | null {
  let value: unknown = context;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return null;
    value = (value as Record<string, unknown>)[key];
  }
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null; // missing, empty, an object, an array
}

/**
 * Splits one paragraph on ** into plain/bold runs. The text is split BEFORE
 * placeholders are filled, so a filled-in value that happens to contain ** can
 * never switch bold on or off. An unclosed ** is just printed.
 */
function toSegments(paragraph: string): Segment[] {
  const parts = paragraph.split('**');
  const segments: Segment[] = [];
  parts.forEach((text, i) => {
    const isLast = i === parts.length - 1;
    const bold = i % 2 === 1;
    if (bold && isLast && parts.length % 2 === 0) {
      // Opening ** with no closing one: keep it literal, as ordinary text.
      segments.push({ text: `**${text}`, bold: false });
    } else if (text !== '') {
      segments.push({ text, bold });
    }
  });
  return segments;
}

export function renderTemplate(body: string, context: RenderContext): RenderResult {
  const missing: string[] = [];
  const seen = new Set<string>();

  const fill = (text: string) =>
    text.replace(PLACEHOLDER, (_match, path: string) => {
      const value = lookup(context, path);
      if (value === null) {
        if (!seen.has(path)) { seen.add(path); missing.push(path); }
        return '';
      }
      // A multi-line value (e.g. an address) reads as one line inside a sentence.
      return value.replace(/\s*\r?\n\s*/g, ', ');
    });

  const split = (text: string) => text.split(PARAGRAPH_BREAK).map((p) => p.trim()).filter((p) => p !== '');

  // A {{{block}}} alone on a line becomes the paragraphs the author wrote. One
  // level only: a block inside a block is read as an ordinary inline value.
  const expandBlocks = (list: string[], depth: number): string[] =>
    list.flatMap((p) => {
      const m = depth === 0 ? BLOCK_PLACEHOLDER.exec(p) : null;
      if (!m) return [p];
      const value = lookup(context, m[1]);
      if (value === null) {
        if (!seen.has(m[1])) { seen.add(m[1]); missing.push(m[1]); }
        return [];
      }
      return expandBlocks(split(value), depth + 1);
    });

  const paragraphs: Paragraph[] = expandBlocks(split(body), 0)
    .map((p) => toSegments(p).map((s) => ({ ...s, text: fill(s.text) })))
    // A paragraph that was only unfilled placeholders is left out rather than printed empty.
    .filter((segments) => segments.some((s) => s.text.trim() !== ''));

  return { paragraphs, missing };
}

/** Every placeholder path used by a template, once each, in order of first use. */
export function listPlaceholders(body: string): string[] {
  const found: string[] = [];
  for (const m of body.matchAll(PLACEHOLDER)) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

/** The plain text of a paragraph (for tests, search and the like). */
export const paragraphText = (p: Paragraph): string => p.map((s) => s.text).join('');

// ── What a template can use ────────────────────────────────────────────────

/**
 * The HR-friendly placeholder names and the employee column each one reads.
 * This is the ONE place the mapping lives: the names HR writes in a template
 * (position, startDate, ...) are not always the column names.
 */
export const EMPLOYEE_FIELD_MAP = {
  position: 'role',
  department: 'department',
  startDate: 'employmentStartDate',
  endDate: 'employmentEndDate',
  address: 'address',
} as const;

/** Shown to HR in the template editor and listed in the hand-over notes. */
export const PLACEHOLDER_REFERENCE: { path: string; description: string; example: string }[] = [
  { path: 'company.name', description: 'Company name', example: "Abby's Legendary Caterers Limited" },
  { path: 'company.address', description: 'Company address', example: 'Plot # 362 Makenya Street, Regent Estate - Mikocheni, P.O. Box 25187, Dar es Salaam' },
  { path: 'company.phone', description: 'Company phone', example: '+255 000 000 000' },
  { path: 'company.email', description: 'Company email', example: 'hr@example.com' },
  { path: 'company.tin', description: 'Company TIN', example: '151-209-696' },
  { path: 'company.vrn', description: 'Company VRN', example: '40-050290-L' },
  { path: 'doc.refNo', description: 'Reference number (assigned when the letter is issued)', example: 'ALC/HR/GEN/2026/0001' },
  { path: 'doc.date', description: 'Date of the letter', example: '14 October 2026' },
  { path: 'doc.subject', description: 'Subject line', example: 'Confirmation of employment' },
  { path: 'employee.fullName', description: 'Full name', example: 'Amina Juma' },
  { path: 'employee.firstName', description: 'First name', example: 'Amina' },
  { path: 'employee.lastName', description: 'Last name', example: 'Juma' },
  { path: 'employee.employeeId', description: 'Employee ID', example: 'EMP-001' },
  { path: 'employee.position', description: 'Job title (the Role on the employee record)', example: 'Head Chef' },
  { path: 'employee.department', description: 'Department', example: 'Kitchen' },
  { path: 'employee.startDate', description: 'Employment start date', example: '3 March 2024' },
  { path: 'employee.endDate', description: 'Employment end date', example: '30 June 2026' },
  { path: 'employee.salary', description: 'Monthly salary', example: 'TZS 1,200,000' },
  { path: 'employee.address', description: 'Home address', example: 'Mikocheni, Dar es Salaam' },
  { path: 'signatory.name', description: 'Name of the person signing (the approver)', example: 'Neema Mushi' },
  { path: 'signatory.title', description: 'Title of the person signing', example: 'HR Manager' },
];

/** Printed in previews and drafts, where no number exists yet. */
export const PENDING_REF = '[assigned when issued]';

/** 14 October 2026. Date-only strings are read as calendar dates, never shifted by time zone. */
export function formatLongDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface BuildContextInput {
  company?: CompanyDetails;
  employee?: Partial<Employee> | null;
  /** Omit before issue: the reference prints as PENDING_REF. */
  refNo?: string | null;
  /** yyyy-MM-dd */
  date: string;
  subject?: string;
  signatory?: { name?: string | null; title?: string | null };
  /** The document's own values. Built-in names always win over these. */
  data?: Record<string, unknown>;
}

export function buildRenderContext(input: BuildContextInput): RenderContext {
  const { company = {}, employee, signatory, data = {} } = input;

  const emp: Record<string, unknown> = {};
  if (employee) {
    const m = EMPLOYEE_FIELD_MAP;
    emp.fullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
    emp.firstName = employee.firstName;
    emp.lastName = employee.lastName;
    emp.employeeId = employee.id;
    emp.position = employee[m.position];
    emp.department = employee[m.department];
    emp.startDate = formatLongDate(employee[m.startDate]);
    emp.endDate = formatLongDate(employee[m.endDate]);
    emp.address = employee[m.address];
    emp.salary = typeof employee.monthlySalary === 'number' ? formatTZS(employee.monthlySalary) : undefined;
  }

  return {
    ...data,
    data,
    company: { ...company },
    doc: { refNo: input.refNo || PENDING_REF, date: formatLongDate(input.date), subject: input.subject },
    employee: emp,
    signatory: { name: signatory?.name, title: signatory?.title },
  };
}
