import { Product } from '@/types/excel';
import { NhanhApiClient } from '@/services/nhanhApi';
import {
    InventoryCheckResult,
    InventoryValidationResult
} from '@/types/inventoryTypes';
import { DEFAULT_DEPOT_ID } from './constants';

/**
 * Validate inventory by comparing Excel quantities with actual NhanhVN inventory
 * @param products Products from Excel file
 * @param nhanhClient NhanhVN API client
 * @param depotId Depot ID to check (default: 215639)
 * @returns Validation result with detailed comparison
 */
export async function validateInventory(
    products: Product[],
    nhanhClient: NhanhApiClient,
    depotId: number = DEFAULT_DEPOT_ID
): Promise<InventoryValidationResult> {
    if (products.length === 0) {
        return {
            allSufficient: true,
            checks: [],
            totalProducts: 0,
            insufficientCount: 0,
            outOfStockCount: 0,
        };
    }

    // Get all product IDs
    const productIds = products.map(p => p.id);

    // Fetch inventory from NhanhVN
    const inventoryMap = await nhanhClient.checkProductInventory(productIds, depotId);

    // Compare Excel quantities with actual inventory
    const checks: InventoryCheckResult[] = products.map(product => {
        const actualInventory = inventoryMap.get(product.id) ?? 0;
        const excelQuantity = product.quantity;

        let status: 'sufficient' | 'insufficient' | 'out_of_stock';
        if (actualInventory === 0) {
            status = 'out_of_stock';
        } else if (actualInventory < excelQuantity) {
            status = 'insufficient';
        } else {
            status = 'sufficient';
        }

        return {
            productId: product.id,
            productName: product.name || `SP#${product.id}`,
            excelQuantity,
            actualInventory,
            status,
        };
    });

    const insufficientCount = checks.filter(c => c.status === 'insufficient').length;
    const outOfStockCount = checks.filter(c => c.status === 'out_of_stock').length;
    const allSufficient = insufficientCount === 0 && outOfStockCount === 0;

    return {
        allSufficient,
        checks,
        totalProducts: products.length,
        insufficientCount,
        outOfStockCount,
    };
}

/**
 * Adjust product quantities to match actual inventory
 * @param products Original products from Excel
 * @param inventoryMap Map of productId -> actual inventory
 * @returns New product array with adjusted quantities
 */
export function adjustProductsToInventory(
    products: Product[],
    inventoryMap: Map<number, number>
): Product[] {
    return products.map(product => {
        const actualInventory = inventoryMap.get(product.id) ?? 0;
        return {
            ...product,
            quantity: Math.min(product.quantity, actualInventory),
        };
    });
}

/**
 * Get inventory map as a simple object for easier consumption
 * @param products Products to check
 * @param nhanhClient NhanhVN API client
 * @param depotId Depot ID
 * @returns Map of productId -> available quantity
 */
export async function getInventoryMap(
    products: Product[],
    nhanhClient: NhanhApiClient,
    depotId: number = DEFAULT_DEPOT_ID
): Promise<Map<number, number>> {
    const productIds = products.map(p => p.id);
    return await nhanhClient.checkProductInventory(productIds, depotId);
}
