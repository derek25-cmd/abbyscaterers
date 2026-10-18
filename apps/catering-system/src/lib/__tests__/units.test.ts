import { describe, it, expect } from 'vitest';
import { toPriceUnit, UnitError, TO_BASE } from '../costing/units';

describe('toPriceUnit', () => {
  it('converts gms to kg', () => {
    expect(toPriceUnit(500, 'gms', 'kg')).toBeCloseTo(0.5);
    expect(toPriceUnit(250, 'g', 'kg')).toBeCloseTo(0.25);
    expect(toPriceUnit(1, 'grams', 'kg')).toBeCloseTo(0.001);
  });

  it('keeps kg as kg', () => {
    expect(toPriceUnit(2.5, 'kg', 'kg')).toBe(2.5);
  });

  it('converts the other way within a family (kg -> gms, liters -> ml)', () => {
    expect(toPriceUnit(1.2, 'kg', 'gms')).toBeCloseTo(1200);
    expect(toPriceUnit(0.5, 'liters', 'ml')).toBeCloseTo(500);
    expect(toPriceUnit(250, 'ml', 'l')).toBeCloseTo(0.25);
  });

  it('converts item to kg with gramsPerItem', () => {
    // 6 eggs at 60 g each = 0.36 kg
    expect(toPriceUnit(6, 'item', 'kg', 60)).toBeCloseTo(0.36);
    expect(toPriceUnit(6, 'pcs', 'gms', 60)).toBeCloseTo(360);
  });

  it('throws for item to kg without gramsPerItem', () => {
    expect(() => toPriceUnit(6, 'item', 'kg')).toThrow(UnitError);
    expect(() => toPriceUnit(6, 'item', 'kg', null)).toThrow(UnitError);
    expect(() => toPriceUnit(6, 'item', 'kg', 0)).toThrow(UnitError);
    expect(() => toPriceUnit(6, 'item', 'kg', -5)).toThrow(UnitError);
  });

  it('converts kg to pcs with gramsPerItem', () => {
    // 1.5 kg of 250 g loaves = 6 pieces
    expect(toPriceUnit(1.5, 'kg', 'pcs', 250)).toBeCloseTo(6);
    expect(toPriceUnit(500, 'gms', 'item', 50)).toBeCloseTo(10);
  });

  it('throws for an unknown unit', () => {
    expect(() => toPriceUnit(1, 'sachet', 'kg')).toThrow(UnitError);
    expect(() => toPriceUnit(1, 'kg', 'box')).toThrow(/Unknown price unit "box"/);
    expect(() => toPriceUnit(1, '', 'kg')).toThrow(UnitError);
  });

  it('throws across families that cannot be converted', () => {
    expect(() => toPriceUnit(1, 'kg', 'liters')).toThrow(UnitError);
    expect(() => toPriceUnit(1, 'bunch', 'kg', 100)).toThrow(UnitError);
    expect(() => toPriceUnit(1, 'ml', 'pcs', 100)).toThrow(UnitError);
  });

  it('accepts mixed case and surrounding whitespace', () => {
    expect(toPriceUnit(500, ' GMS ', 'Kg')).toBeCloseTo(0.5);
    expect(toPriceUnit(2, '\tItem', ' PCS\n')).toBe(2);
    expect(toPriceUnit(3, 'Bunch', 'bunch')).toBe(3);
  });

  it('rejects a non-numeric quantity', () => {
    expect(() => toPriceUnit(Number.NaN, 'kg', 'kg')).toThrow(UnitError);
  });

  it('maps every unit to one of the four base units', () => {
    for (const { base } of Object.values(TO_BASE)) {
      expect(['kg', 'liters', 'pcs', 'bunch']).toContain(base);
    }
  });
});
