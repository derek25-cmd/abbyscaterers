import { describe, it, expect } from 'vitest';
import {
  PENDING_REF, buildRenderContext, formatLongDate, listPlaceholders, paragraphText, renderTemplate,
} from '../hr-docs/render';

const text = (body: string, ctx: Record<string, unknown>) => renderTemplate(body, ctx).paragraphs.map(paragraphText);

describe('renderTemplate: placeholders', () => {
  it('fills a simple placeholder', () => {
    expect(text('Dear {{name}},', { name: 'Amina' })).toEqual(['Dear Amina,']);
  });

  it('fills nested paths', () => {
    const ctx = { employee: { fullName: 'Amina Juma', job: { title: 'Chef' } } };
    expect(text('{{employee.fullName}} is a {{employee.job.title}}.', ctx)).toEqual(['Amina Juma is a Chef.']);
  });

  it('allows spaces inside the braces', () => {
    expect(text('Hi {{ name }}', { name: 'Amina' })).toEqual(['Hi Amina']);
  });

  it('reports a missing field once, in order, and prints it blank', () => {
    const r = renderTemplate('{{a}} and {{b.c}} and {{a}} again', { b: {} });
    expect(r.missing).toEqual(['a', 'b.c']);
    expect(r.paragraphs.map(paragraphText)).toEqual([' and  and  again']);
  });

  it('treats empty, whitespace-only, null and object values as missing', () => {
    const r = renderTemplate('{{a}} {{b}} {{c}} {{d}}', { a: '', b: '   ', c: null, d: { x: 1 } });
    expect(r.missing).toEqual(['a', 'b', 'c', 'd']);
  });

  it('accepts numbers (including 0) and booleans', () => {
    const r = renderTemplate('{{n}} {{z}} {{t}}', { n: 12, z: 0, t: true });
    expect(r.missing).toEqual([]);
    expect(r.paragraphs.map(paragraphText)).toEqual(['12 0 Yes']);
  });

  it('does not run anything: no logic, no HTML', () => {
    const r = renderTemplate('{{#if x}}hi{{/if}} <b>no</b> {{a.b}}', { x: true });
    expect(r.paragraphs.map(paragraphText)[0]).toContain('<b>no</b>');
    expect(r.missing).toEqual(['a.b']);
  });

  it('puts a multi-line value on one line inside a sentence', () => {
    expect(text('At {{addr}}.', { addr: 'Plot 362\nP.O. Box 1' })).toEqual(['At Plot 362, P.O. Box 1.']);
  });
});

describe('renderTemplate: paragraphs', () => {
  it('splits on blank lines and ignores extra blank lines', () => {
    expect(text('One\n\n\n\nTwo\r\n\r\nThree', {})).toEqual(['One', 'Two', 'Three']);
  });

  it('keeps a single line break inside a paragraph', () => {
    expect(text('Line one\nLine two', {})).toEqual(['Line one\nLine two']);
  });

  it('returns nothing for an empty body', () => {
    expect(renderTemplate('  \n\n  ', {}).paragraphs).toEqual([]);
  });

  it('drops a paragraph that is only unfilled placeholders, but still reports them', () => {
    const r = renderTemplate('Hello\n\n{{missing}}\n\nBye', {});
    expect(r.paragraphs.map(paragraphText)).toEqual(['Hello', 'Bye']);
    expect(r.missing).toEqual(['missing']);
  });
});

describe('renderTemplate: bold', () => {
  it('marks **bold** runs', () => {
    const [p] = renderTemplate('This is **important** news', {}).paragraphs;
    expect(p).toEqual([
      { text: 'This is ', bold: false },
      { text: 'important', bold: true },
      { text: ' news', bold: false },
    ]);
  });

  it('fills placeholders inside bold', () => {
    const [p] = renderTemplate('Dear **{{name}}**,', { name: 'Amina' }).paragraphs;
    expect(p).toEqual([{ text: 'Dear ', bold: false }, { text: 'Amina', bold: true }, { text: ',', bold: false }]);
  });

  it('reports a missing placeholder inside bold', () => {
    expect(renderTemplate('**{{who}}**', {}).missing).toEqual(['who']);
  });

  it('a value containing ** cannot switch bold on', () => {
    const [p] = renderTemplate('Name: {{n}}', { n: 'A**B' }).paragraphs;
    expect(p.every((s) => !s.bold)).toBe(true);
    expect(paragraphText(p)).toBe('Name: A**B');
  });

  it('prints an unclosed ** as it is', () => {
    const [p] = renderTemplate('half **open', {}).paragraphs;
    expect(paragraphText(p)).toBe('half **open');
    expect(p.every((s) => !s.bold)).toBe(true);
  });
});

describe('renderTemplate: {{{block}}} placeholders', () => {
  const body = 'Dear {{name}},\n\n{{{body}}}\n\nThank you.';

  it('expands a block into the paragraphs the author wrote', () => {
    const r = renderTemplate(body, { name: 'Amina', body: 'First paragraph.\n\nSecond one,\nwith a line break.' });
    expect(r.missing).toEqual([]);
    expect(r.paragraphs.map(paragraphText)).toEqual(['Dear Amina,', 'First paragraph.', 'Second one,\nwith a line break.', 'Thank you.']);
  });

  it('allows **bold** and {{fields}} inside the block', () => {
    const r = renderTemplate('{{{body}}}', { name: 'Amina', body: 'Please note **{{name}}** is away.' });
    expect(r.paragraphs[0]).toEqual([
      { text: 'Please note ', bold: false }, { text: 'Amina', bold: true }, { text: ' is away.', bold: false },
    ]);
  });

  it('reports a field missing inside the block', () => {
    expect(renderTemplate('{{{body}}}', { body: 'Hello {{who}}' }).missing).toEqual(['who']);
  });

  it('reports the block itself when it is empty or absent', () => {
    expect(renderTemplate(body, { name: 'A', body: '   ' }).missing).toEqual(['body']);
    expect(renderTemplate(body, { name: 'A' }).missing).toEqual(['body']);
  });

  it('does not expand a block inside the block (no loops)', () => {
    const r = renderTemplate('{{{body}}}', { body: 'Start\n\n{{{body}}}' });
    expect(r.paragraphs.length).toBe(2);
    expect(paragraphText(r.paragraphs[1])).toContain('Start');
  });

  it('treats {{{x}}} in the middle of a sentence like {{x}}', () => {
    expect(renderTemplate('Hello {{{n}}}!', { n: 'Amina' }).paragraphs.map(paragraphText)).toEqual(['Hello Amina!']);
  });

  it('lists the block placeholder once in listPlaceholders', () => {
    expect(listPlaceholders('{{a}}\n\n{{{body}}}\n\n{{a}}')).toEqual(['a', 'body']);
  });
});

describe('listPlaceholders', () => {
  it('lists each path once, in order of first use', () => {
    expect(listPlaceholders('{{b}} {{a.c}} **{{b}}** {{ d }}')).toEqual(['b', 'a.c', 'd']);
  });
  it('is empty for plain text', () => {
    expect(listPlaceholders('no placeholders')).toEqual([]);
  });
});

describe('buildRenderContext', () => {
  const employee = {
    id: 'EMP-1', firstName: 'Amina', middleName: 'K', lastName: 'Juma', role: 'Head Chef', department: 'Kitchen',
    employmentStartDate: '2024-03-03', employmentEndDate: null, address: 'Mikocheni', monthlySalary: 1200000,
  } as never;

  it('maps the friendly names onto the employee columns', () => {
    const ctx = buildRenderContext({ employee, date: '2026-10-14', refNo: 'ALC/HR/GEN/2026/0001' });
    const out = renderTemplate(
      '{{employee.fullName}}|{{employee.position}}|{{employee.startDate}}|{{employee.address}}|{{doc.refNo}}|{{doc.date}}', ctx,
    );
    expect(out.missing).toEqual([]);
    expect(paragraphText(out.paragraphs[0])).toBe('Amina K Juma|Head Chef|3 March 2024|Mikocheni|ALC/HR/GEN/2026/0001|14 October 2026');
  });

  it('formats the salary in TZS', () => {
    const out = renderTemplate('{{employee.salary}}', buildRenderContext({ employee, date: '2026-10-14' }));
    expect(paragraphText(out.paragraphs[0])).toMatch(/1,200,000/);
  });

  it('reports an employee end date that is not set', () => {
    const out = renderTemplate('{{employee.endDate}}', buildRenderContext({ employee, date: '2026-10-14' }));
    expect(out.missing).toEqual(['employee.endDate']);
  });

  it('shows a placeholder reference before the number is assigned', () => {
    const out = renderTemplate('{{doc.refNo}}', buildRenderContext({ date: '2026-10-14' }));
    expect(out.missing).toEqual([]);
    expect(paragraphText(out.paragraphs[0])).toBe(PENDING_REF);
  });

  it('reports company.address when it is empty', () => {
    const ctx = buildRenderContext({ date: '2026-10-14', company: { name: 'Abby', address: '' } });
    expect(renderTemplate('{{company.name}} {{company.address}}', ctx).missing).toEqual(['company.address']);
  });

  it('exposes the document data, but built-in names win', () => {
    const ctx = buildRenderContext({ date: '2026-10-14', data: { reason: 'Visa', employee: { fullName: 'HIJACK' } }, employee });
    const out = renderTemplate('{{reason}} / {{data.reason}} / {{employee.fullName}}', ctx);
    expect(paragraphText(out.paragraphs[0])).toBe('Visa / Visa / Amina K Juma');
  });

  it('takes the signatory from the input', () => {
    const ctx = buildRenderContext({ date: '2026-10-14', signatory: { name: 'Neema', title: 'HR Manager' } });
    expect(paragraphText(renderTemplate('{{signatory.name}}, {{signatory.title}}', ctx).paragraphs[0])).toBe('Neema, HR Manager');
  });
});

describe('formatLongDate', () => {
  it('formats a date-only string without shifting it', () => {
    expect(formatLongDate('2026-01-01')).toBe('1 January 2026');
    expect(formatLongDate('2026-12-31')).toBe('31 December 2026');
  });
  it('returns empty for no value and the original for junk', () => {
    expect(formatLongDate(null)).toBe('');
    expect(formatLongDate('soon')).toBe('soon');
    expect(formatLongDate('2026-02-31')).toBe('2026-02-31');
  });
});
