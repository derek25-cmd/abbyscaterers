import { describe, it, expect } from 'vitest';
import { HR_MODULES, isHrModuleOn, moduleOfDocType, parseHrModules } from '../hr-modules-core';

describe('parseHrModules', () => {
  it('NULL or an unreadable value means every module is on', () => {
    expect([...parseHrModules(null)]).toEqual([...HR_MODULES]);
    expect([...parseHrModules(undefined)]).toEqual([...HR_MODULES]);
    expect([...parseHrModules('leave')]).toEqual([...HR_MODULES]);
  });
  it('an empty list means every module is off', () => {
    expect(parseHrModules([]).size).toBe(0);
  });
  it('keeps known modules and drops anything else', () => {
    expect([...parseHrModules(['leave', 'payroll', 42, 'audit'])].sort()).toEqual(['audit', 'leave']);
  });
});

describe('isHrModuleOn', () => {
  const on = (...m: string[]) => parseHrModules(m);
  it('a module is on when it is in the list', () => {
    expect(isHrModuleOn(on('audit', 'leave'), 'leave')).toBe(true);
    expect(isHrModuleOn(on('audit'), 'leave')).toBe(false);
  });
  it('letter types need HR Documents', () => {
    expect(isHrModuleOn(on('letters'), 'letters')).toBe(false);
    expect(isHrModuleOn(on('documents', 'letters'), 'letters')).toBe(true);
  });
  it('candidates need HR Documents and the letter types', () => {
    expect(isHrModuleOn(on('documents', 'candidates'), 'candidates')).toBe(false);
    expect(isHrModuleOn(on('documents', 'letters', 'candidates'), 'candidates')).toBe(true);
  });
  it('the go-live order works: audit and leave first, then the rest', () => {
    const first = on('audit', 'leave');
    expect(['audit', 'leave', 'documents', 'letters', 'candidates'].map((m) => isHrModuleOn(first, m as never)))
      .toEqual([true, true, false, false, false]);
  });
});

describe('moduleOfDocType', () => {
  it('maps each letter type to its module', () => {
    expect(moduleOfDocType('general_letter')).toBe('documents');
    expect(moduleOfDocType('offer')).toBe('candidates');
    for (const t of ['contract', 'extension', 'termination', 'warning', 'recognition', 'certificate_of_service'] as const) {
      expect(moduleOfDocType(t)).toBe('letters');
    }
  });
});
