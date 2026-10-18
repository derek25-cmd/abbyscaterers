/**
 * Unit conversion for menu costing (data-readiness Phase 2, Step 4).
 *
 * A recipe line is in one unit (e.g. "gms"), the product's price is per
 * another (products.base_unit, falling back to products.unit, e.g. "kg").
 * toPriceUnit() converts the recipe quantity into the price unit, so that
 * quantity x price is right. Anything it cannot convert honestly throws
 * UnitError, and costing reports the line as missing instead of guessing.
 */

export type BaseUnit = 'kg' | 'liters' | 'pcs' | 'bunch';

/** unit (lower case) -> its base unit and how many base units one of it is. */
export const TO_BASE: Readonly<Record<string, { base: BaseUnit; factor: number }>> = {
    g: { base: 'kg', factor: 0.001 },
    gms: { base: 'kg', factor: 0.001 },
    grams: { base: 'kg', factor: 0.001 },
    kg: { base: 'kg', factor: 1 },
    ml: { base: 'liters', factor: 0.001 },
    l: { base: 'liters', factor: 1 },
    liters: { base: 'liters', factor: 1 },
    item: { base: 'pcs', factor: 1 },
    pcs: { base: 'pcs', factor: 1 },
    bunch: { base: 'bunch', factor: 1 },
};

export class UnitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnitError';
    }
}

const lookup = (unit: string, role: string) => {
    const key = (unit ?? '').toString().trim().toLowerCase();
    const entry = TO_BASE[key];
    if (!entry) {
        throw new UnitError(`Unknown ${role} unit "${unit}"`);
    }
    return entry;
};

/**
 * Converts `qty` from `recipeUnit` into `priceUnit`.
 * - Same family (kg/g, liters/ml, pcs/item, bunch): plain conversion.
 * - pieces <-> kg family: only with gramsPerItem (weight of one piece, > 0).
 * - Anything else (kg <-> liters, bunch <-> kg, unknown units): UnitError.
 */
export function toPriceUnit(
    qty: number,
    recipeUnit: string,
    priceUnit: string,
    gramsPerItem?: number | null,
): number {
    if (typeof qty !== 'number' || !Number.isFinite(qty)) {
        throw new UnitError(`Quantity "${qty}" is not a number`);
    }
    const from = lookup(recipeUnit, 'recipe');
    const to = lookup(priceUnit, 'price');

    if (from.base === to.base) {
        return (qty * from.factor) / to.factor;
    }

    const weightPieces =
        (from.base === 'pcs' && to.base === 'kg') || (from.base === 'kg' && to.base === 'pcs');
    if (weightPieces) {
        if (gramsPerItem == null || !Number.isFinite(gramsPerItem) || gramsPerItem <= 0) {
            throw new UnitError(
                `Cannot convert ${recipeUnit} to ${priceUnit} without the weight of one piece (grams per item)`,
            );
        }
        if (from.base === 'pcs') {
            const kg = qty * from.factor * gramsPerItem * 0.001;
            return kg / to.factor;
        }
        const pieces = (qty * from.factor * 1000) / gramsPerItem;
        return pieces / to.factor;
    }

    throw new UnitError(`Cannot convert ${recipeUnit} (${from.base}) to ${priceUnit} (${to.base})`);
}
