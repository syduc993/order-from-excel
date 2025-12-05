import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getStatusColor, getStatusText } from '@/utils/orderUtils';

interface OrderListProps {
    orders: any[];
    isLoading: boolean;
    pagination: {
        page: number;
        pageSize: number;
        totalPages: number;
        count: number;
    } | null;
    onPageChange: (page: number) => void;
}

export const OrderList = ({ orders, isLoading, pagination, onPageChange }: OrderListProps) => {
    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500">
                Chưa có đơn hàng nào được tạo.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Index</TableHead>
                            <TableHead>Khách hàng</TableHead>
                            <TableHead>Sản phẩm</TableHead>
                            <TableHead>Tổng tiền</TableHead>
                            <TableHead>Thời gian dự kiến</TableHead>
                            <TableHead>Trạng thái</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell>{order.order_index}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{order.customer_name}</div>
                                    <div className="text-sm text-gray-500">{order.customer_phone}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="max-w-[300px] text-sm">
                                        {order.order_data?.products?.map((p: any) => (
                                            <div key={p.id} className="truncate">
                                                {p.quantity}x SP#{p.id}
                                            </div>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {order.total_amount?.toLocaleString('vi-VN')} ₫
                                </TableCell>
                                <TableCell>
                                    {order.scheduled_time
                                        ? new Date(order.scheduled_time).toLocaleString('vi-VN')
                                        : '-'}
                                </TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                        {getStatusText(order.status)}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {pagination && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Hiển thị {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.count)} trong số {pagination.count} đơn hàng
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                        >
                            Trước
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                        >
                            Sau
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
