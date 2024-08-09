import { GetProductsForIngredient } from "./supporting-files/data-access";
import {ConvertUnits, GetNutrientFactInBaseUnits} from "./supporting-files/helpers";
import { Product, Recipe, RecipeLineItem, NutrientFact, UoMName, UoMType, UnitOfMeasure } from "./supporting-files/models";

function findCheapestProduct(lineItem: RecipeLineItem): { product: Product; cost: number } {
    const products = GetProductsForIngredient(lineItem.ingredient);
    let cheapestProduct = products[0];
    let cheapestCost = Infinity;

    const { uomAmount: lineItemGrams} = convertToGrams(lineItem.unitOfMeasure);

    for (const product of products) {
        for (const supplierProduct of product.supplierProducts) {
            const price = supplierProduct.supplierPrice;
            const { uomAmount: supplierGrams } = convertToGrams(supplierProduct.supplierProductUoM);
            const cost = price / supplierGrams;
            const totalCost = cost * lineItemGrams;
            if (cheapestCost > totalCost) {
                cheapestProduct = product;
                cheapestCost = totalCost;
            }
        }
    }

    return { product: cheapestProduct, cost: cheapestCost };
}

function convertToGrams(uom: UnitOfMeasure): UnitOfMeasure {
    if (uom.uomType === UoMType.mass && uom.uomName === UoMName.grams) {
        return uom;
    }
    if (uom.uomType === UoMType.volume) {
        const mlUom = ConvertUnits(uom, UoMName.millilitres, UoMType.volume);
        return ConvertUnits(mlUom, UoMName.grams, UoMType.mass);
    }
    return ConvertUnits(uom, UoMName.grams, UoMType.mass);
}

function sumNutrientFacts(existingFacts: { [key: string]: NutrientFact }, newFacts: NutrientFact[]): void {
    for (const fact of newFacts) {
        const convertFact = GetNutrientFactInBaseUnits(fact);

        if (existingFacts[fact.nutrientName]) {
            existingFacts[fact.nutrientName].quantityAmount.uomAmount += convertFact.quantityAmount.uomAmount;
        } else {
            existingFacts[fact.nutrientName] = convertFact;
        }
    }
}

export function calculateRecipeSummary(recipe: Recipe): any {
    let totalCost = 0;
    const nutrients: { [key: string]: NutrientFact } = {};

    for (const lineItem of recipe.lineItems) {
        const { product, cost } = findCheapestProduct(lineItem);

        totalCost += cost;
        sumNutrientFacts(nutrients, product.nutrientFacts);
    }

    // Round nutrient amounts to 1 decimal place for most nutrients, and 3 decimal places for Sodium
    for (const [nutrientName, nutrient] of Object.entries(nutrients)) {
        if (nutrientName === 'Sodium') {
            nutrient.quantityAmount.uomAmount = Number(nutrient.quantityAmount.uomAmount.toFixed(3));
        } else {
            nutrient.quantityAmount.uomAmount = Number(nutrient.quantityAmount.uomAmount.toFixed(1));
        }
    }

    return {
        cheapestCost: Number(totalCost.toFixed(15)),  // Keep more decimal places for cost
        nutrientsAtCheapestCost: nutrients
    };
}