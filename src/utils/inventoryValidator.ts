import { Product } from '@/types/excel';
import { NhanhApiClient } from '@/services/nhanhApi';
import {
    InventoryCheckResult,
    InventoryValidationResult
} from '@/types/inventoryTypes';
import { DEFAULT_SETTINGS } from '@/types/settings';

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
    depotId: number = DEFAULT_SETTINGS.apiConfig.depotId
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

    // Aggregate products by ID - sum quantities for same productId
    const aggregatedProducts = new Map<number, { id: number; name: string; totalQuantity: number }>();
    for (const product of products) {
        const existing = aggregatedProducts.get(product.id);
        if (existing) {
            existing.totalQuantity += product.quantity;
        } else {
            aggregatedProducts.set(product.id, {
                id: product.id,
                name: product.name || `SP#${product.id}`,
                totalQuantity: product.quantity,
            });
        }
    }

    // Get unique product IDs
    const productIds = Array.from(aggregatedProducts.keys());

    // Fetch inventory from NhanhVN
    const inventoryMap = await nhanhClient.checkProductInventory(productIds, depotId);

    // Compare Excel quantities with actual inventory
    const checks: InventoryCheckResult[] = Array.from(aggregatedProducts.values()).map(product => {
        const actualInventory = inventoryMap.get(product.id) ?? 0;
        const excelQuantity = product.totalQuantity;

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
            productName: product.name,
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
        totalProducts: aggregatedProducts.size,
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
    depotId: number = DEFAULT_SETTINGS.apiConfig.depotId
): Promise<Map<number, number>> {
    const productIds = products.map(p => p.id);
    return await nhanhClient.checkProductInventory(productIds, depotId);
}
