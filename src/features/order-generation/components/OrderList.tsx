import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, MoreVertical, Eye, XCircle, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { getStatusColor, getStatusText } from '@/utils/orderUtils';
import { TablePagination } from '@/components/TablePagination';

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
    onPageSizeChange?: (pageSize: number) => void;
    selectedIds?: number[];
    onSelectionChange?: (ids: number[]) => void;
    onViewDetail?: (order: any) => void;
    onCancel?: (orderId: number) => void;
    onRetry?: (orderId: number) => void;
    onEdit?: (order: any) => void;
    onDelete?: (orderId: number) => void;
    canCreate?: boolean;
}

export const OrderList = ({
    orders,
    isLoading,
    pagination,
    onPageChange,
    onPageSizeChange,
    selectedIds = [],
    onSelectionChange,
    onViewDetail,
    onCancel,
    onRetry,
    onEdit,
    onDelete,
    canCreate = false,
}: OrderListProps) => {
    const selectableOrders = orders.filter(o => ['draft', 'cancelled'].includes(o.status));
    const hasSelectable = selectableOrders.length > 0;
    const showCheckboxes = hasSelectable && onSelectionChange;
    const showActions = onViewDetail || onCancel || onRetry || onEdit || onDelete;

    const allSelectableSelected = selectableOrders.length > 0 && selectableOrders.every(o => selectedIds.includes(o.id));

    const toggleAll = () => {
        if (!onSelectionChange) return;
        if (allSelectableSelected) {
            onSelectionChange(selectedIds.filter(id => !selectableOrders.some(o => o.id === id)));
        } else {
            const newIds = [...new Set([...selectedIds, ...selectableOrders.map(o => o.id)])];
            onSelectionChange(newIds);
        }
    };

    const toggleOne = (orderId: number) => {
        if (!onSelectionChange) return;
        if (selectedIds.includes(orderId)) {
            onSelectionChange(selectedIds.filter(id => id !== orderId));
        } else {
            onSelectionChange([...selectedIds, orderId]);
        }
    };

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
                            {showCheckboxes && (
                                <TableHead className="w-[40px]">
                                    <Checkbox
                                        checked={allSelectableSelected}
                                        onCheckedChange={toggleAll}
                                    />
                                </TableHead>
                            )}
                            <TableHead className="w-[60px]">#</TableHead>
                            <TableHead>Khách hàng</TableHead>
                            <TableHead>Sản phẩm</TableHead>
                            <TableHead>Tổng tiền</TableHead>
                            <TableHead>Thời gian dự kiến</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            {showActions && <TableHead className="w-[60px]">Thao tác</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow
                                key={order.id}
                                className={onViewDetail ? 'cursor-pointer hover:bg-muted/50' : ''}
                                onClick={() => onViewDetail?.(order)}
                            >
                                {showCheckboxes && (
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        {['draft', 'cancelled'].includes(order.status) ? (
                                            <Checkbox
                                                checked={selectedIds.includes(order.id)}
                                                onCheckedChange={() => toggleOne(order.id)}
                                            />
                                        ) : null}
                                    </TableCell>
                                )}
                                <TableCell className="font-mono text-xs">{order.order_index}</TableCell>
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
                                        ? new Date(order.scheduled_time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                                        : '-'}
                                </TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                        {getStatusText(order.status)}
                                    </span>
                                </TableCell>
                                {showActions && (
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {onViewDetail && (
                                                    <DropdownMenuItem onClick={() => onViewDetail(order)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Xem chi tiết
                                                    </DropdownMenuItem>
                                                )}
                                                {onCancel && canCreate && ['draft', 'pending'].includes(order.status) && (
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => onCancel(order.id)}
                                                    >
                                                        <XCircle className="mr-2 h-4 w-4" />
                                                        Hủy đơn
                                                    </DropdownMenuItem>
                                                )}
                                                {onRetry && canCreate && order.status === 'failed' && (
                                                    <DropdownMenuItem onClick={() => onRetry(order.id)}>
                                                        <RotateCcw className="mr-2 h-4 w-4" />
                                                        Thử lại
                                                    </DropdownMenuItem>
                                                )}
                                                {onEdit && canCreate && ['draft', 'pending'].includes(order.status) && (
                                                    <DropdownMenuItem onClick={() => onEdit(order)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Sửa đơn
                                                    </DropdownMenuItem>
                                                )}
                                                {onDelete && canCreate && ['draft', 'cancelled'].includes(order.status) && (
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => onDelete(order.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Xóa đơn
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {pagination && (
                <TablePagination
                    page={pagination.page}
                    pageSize={pagination.pageSize}
                    totalItems={pagination.count}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    itemLabel="đơn hàng"
                />
            )}
        </div>
    );
};
