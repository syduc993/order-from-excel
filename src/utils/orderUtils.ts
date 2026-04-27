import { Product } from '@/types/excel';
import { DEFAULT_SETTINGS } from '@/types/settings';

// Tính số lượng đơn hàng tự động từ sản phẩm
// Trung bình đơn ước bằng min + ratio*(max-min) — ratio < 0.5 bù cho bias 60/30/10 về pool giá thấp.
export const calculateTotalOrders = (
    products: Product[],
    minAmount: number = DEFAULT_SETTINGS.orderRules.minTotalAmount,
    maxAmount: number = DEFAULT_SETTINGS.orderRules.maxTotalAmount,
    ratio: number = DEFAULT_SETTINGS.orderRules.avgOrderValueRatio
): number => {
    if (products.length === 0) return 0;

    const totalProductValue = products.reduce((sum, product) => {
        return sum + (product.quantity * product.price);
    }, 0);

    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const averageOrderValue = minAmount + (maxAmount - minAmount) * clampedRatio;
    if (averageOrderValue <= 0) return 0;

    const calculatedOrders = Math.floor(totalProductValue / averageOrderValue);

    return Math.max(1, calculatedOrders);
};

export const getStatusColor = (status: string) => {
    switch (status) {
        case 'draft': return 'text-purple-600 bg-purple-50';
        case 'pending': return 'text-yellow-600 bg-yellow-50';
        case 'processing': return 'text-blue-600 bg-blue-50';
        case 'completed': return 'text-green-600 bg-green-50';
        case 'failed': return 'text-red-600 bg-red-50';
        case 'cancelled': return 'text-gray-600 bg-gray-50';
        default: return 'text-gray-600 bg-gray-50';
    }
};

export const getStatusText = (status: string) => {
    switch (status) {
        case 'draft': return 'Nháp';
        case 'pending': return 'Đang chờ';
        case 'processing': return 'Đang xử lý';
        case 'completed': return 'Thành công';
        case 'failed': return 'Lỗi';
        case 'cancelled': return 'Đã hủy';
        default: return status;
    }
};

export const ALL_STATUSES = ['draft', 'pending', 'completed', 'failed', 'cancelled'] as const;
