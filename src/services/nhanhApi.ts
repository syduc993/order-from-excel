import { ApiOrderRequest, ApiResponse } from '@/types/api';

interface ApiConfig {
  appId: string;
  businessId: string;
  accessToken: string;
}

export class NhanhApiClient {
  private config: ApiConfig;
  private baseUrl = 'https://pos.open.nhanh.vn/v3.0';

  constructor(config: ApiConfig) {
    this.config = config;
  }

  async createRetailBill(order: ApiOrderRequest): Promise<ApiResponse> {
    const url = `${this.baseUrl}/bill/addretail?appId=${this.config.appId}&businessId=${this.config.businessId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.config.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async createRetailBills(orders: ApiOrderRequest[]): Promise<ApiResponse[]> {
    const results: ApiResponse[] = [];

    for (const order of orders) {
      try {
        const result = await this.createRetailBill(order);
        results.push(result);

        // Delay giữa các request để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Error creating bill:', error);
        results.push({
          code: 0,
          messages: [(error as Error).message],
        });
      }
    }

    return results;
  }

  /**
   * Check product inventory from NhanhVN using /product/list API
   * This API properly supports 'ids' filter and returns accurate inventory data
   * @param productIds Array of product IDs to check (max 100 per batch)
   * @param depotId Deprecated - kept for compatibility but not used
   * @returns Map of productId -> available quantity
   */
  async checkProductInventory(
    productIds: number[],
    depotId: number = 215639
  ): Promise<Map<number, number>> {
    const inventoryMap = new Map<number, number>();

    if (productIds.length === 0) {
      return inventoryMap;
    }

    // Batch products in chunks of 100 (API limit)
    const chunks: number[][] = [];
    for (let i = 0; i < productIds.length; i += 100) {
      chunks.push(productIds.slice(i, i + 100));
    }

    console.log(`[NhanhAPI] Checking inventory for ${productIds.length} products in ${chunks.length} batch(es)`);

    for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
      const chunk = chunks[batchIndex];
      // Use /product/list instead of /product/inventory (more reliable with 'ids' filter)
      const url = `${this.baseUrl}/product/list?appId=${this.config.appId}&businessId=${this.config.businessId}`;

      console.log(`[NhanhAPI] Batch ${batchIndex + 1}/${chunks.length}: Checking ${chunk.length} products`);

      try {
        const requestBody = {
          filters: {
            ids: chunk  // Filter by product IDs
          },
          paginator: { size: 100 }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': this.config.accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.code !== 1) {
          throw new Error(result.messages?.join(', ') || 'Unknown error from NhanhVN API');
        }

        // Extract available inventory for each product
        const returnedProducts = result.data || [];
        console.log(`[NhanhAPI] Batch ${batchIndex + 1}: Received ${returnedProducts.length} products from API`);

        for (const product of returnedProducts) {
          // Use total available inventory across all depots
          // Priority: inventory.available > inventory.remain > 0
          const available = product.inventory?.available ?? product.inventory?.remain ?? 0;
          // Note: product.id (not productId) in /product/list response
          const productId = product.id || product.productId;
          inventoryMap.set(productId, available);

          // Debug log
          console.log(
            `[Inventory] ✓ Product ${productId} (${product.name?.substring(0, 30) || 'Unknown'}...): ` +
            `available=${available}`
          );
        }

        // Check for missing products in response
        const returnedProductIds = new Set(returnedProducts.map((p: any) => p.id || p.productId));
        const missingProducts = chunk.filter(id => !returnedProductIds.has(id));

        if (missingProducts.length > 0) {
          console.warn(
            `[NhanhAPI] ⚠️  ${missingProducts.length} product(s) NOT found in NhanhVN:`,
            missingProducts
          );

          // Set missing products to 0
          for (const productId of missingProducts) {
            inventoryMap.set(productId, 0);
          }
        }

        // Rate limiting delay between batches
        if (chunks.length > 1 && batchIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[NhanhAPI] ❌ Error checking inventory for batch ${batchIndex + 1}:`, error);

        // Set all products in this chunk to 0 inventory on error
        for (const productId of chunk) {
          if (!inventoryMap.has(productId)) {
            inventoryMap.set(productId, 0);
          }
        }
      }
    }

    console.log(`[NhanhAPI] ✅ Inventory check complete. Found ${inventoryMap.size} products`);
    return inventoryMap;
  }
}

