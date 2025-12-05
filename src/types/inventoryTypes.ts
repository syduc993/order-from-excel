// Types for NhanhVN inventory validation

export interface InventoryCheckResult {
    productId: number;
    productName: string;
    excelQuantity: number; // Số lượng từ Excel (có thể đã trừ đơn đã hoàn thành nếu là điều chỉnh)
    actualInventory: number;
    status: 'sufficient' | 'insufficient' | 'out_of_stock';
    // Thông tin bổ sung cho điều chỉnh đơn hàng
    initialQuantity?: number; // Số lượng ban đầu từ Excel (trước khi trừ)
    usedQuantity?: number; // Số lượng đã dùng trong các đơn đã hoàn thành
}

export interface InventoryValidationResult {
    allSufficient: boolean;
    checks: InventoryCheckResult[];
    totalProducts: number;
    insufficientCount: number;
    outOfStockCount: number;
}

// NhanhVN API Response Types
export interface NhanhInventoryDepot {
    id: number;
    remain: number;
    shipping: number;
    damaged: number;
    holding: number;
    available: number;
    warranty?: {
        remain: number;
        holding: number;
    };
}

export interface NhanhInventoryData {
    remain: number;
    shipping: number;
    damaged: number;
    holding: number;
    available: number;
    warranty?: {
        remain: number;
        holding: number;
    };
    depots?: NhanhInventoryDepot[];
}

export interface NhanhProductInventory {
    productId: number;
    barcode?: string;
    name: string;
    prices?: {
        retail: number;
        wholesale: number;
        import: number;
        avgCost: number;
    };
    inventory: NhanhInventoryData;
}

export interface NhanhInventoryResponse {
    code: number;
    messages?: string[];
    data?: NhanhProductInventory[];
    paginator?: {
        next?: any;
    };
}
