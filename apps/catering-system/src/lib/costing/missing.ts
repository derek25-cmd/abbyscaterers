/**
 * Wording for a menu cost that leaves ingredients out because they have no
 * price (see MenuCalculationResult.missingPrices). Shared by the costing
 * screen and the costing PDF so both say the same thing.
 */
export function incompleteCostLabel(missingCount: number): string {
    const noun = missingCount === 1 ? 'ingredient has' : 'ingredients have';
    return `Incomplete — ${missingCount} ${noun} no price`;
}
