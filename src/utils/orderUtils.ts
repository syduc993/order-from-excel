import { Product } from '@/types/excel';

// Tính số lượng đơn hàng tự động từ sản phẩm
export const calculateTotalOrders = (products: Product[]): number => {
    if (products.length === 0) return 0;

    // Tính tổng giá trị sản phẩm: sum(quantity * price)
    const totalProductValue = products.reduce((sum, product) => {
        return sum + (product.quantity * product.price);
    }, 0);

    // Giá trị trung bình mỗi đơn: (300k + 1tr) / 2 = 650k
    const averageOrderValue = (300000 + 1000000) / 2;

    // Số đơn hàng = Tổng giá trị sản phẩm / Giá trị trung bình mỗi đơn
    const calculatedOrders = Math.floor(totalProductValue / averageOrderValue);

    // Đảm bảo tối thiểu 1 đơn nếu có sản phẩm
    return Math.max(1, calculatedOrders);
};

export const getStatusColor = (status: string) => {
    switch (status) {
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
        case 'pending': return 'Đang chờ';
        case 'processing': return 'Đang xử lý';
        case 'completed': return 'Thành công';
        case 'failed': return 'Lỗi';
        case 'cancelled': return 'Đã hủy';
        default: return status;
    }
};
