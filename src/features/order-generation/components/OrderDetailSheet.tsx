import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getStatusColor, getStatusText } from '@/utils/orderUtils';
import { XCircle, RotateCcw, AlertTriangle, Pencil, Trash2 } from 'lucide-react';

interface OrderDetailSheetProps {
    order: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCancel?: (orderId: number) => void;
    onRetry?: (orderId: number) => void;
    onEdit?: (order: any) => void;
    onDelete?: (orderId: number) => void;
    canCreate: boolean;
}

export const OrderDetailSheet = ({
    order,
    open,
    onOpenChange,
    onCancel,
    onRetry,
    onEdit,
    onDelete,
    canCreate,
}: OrderDetailSheetProps) => {
    if (!order) return null;

    const products = order.order_data?.products || [];
    const canCancelOrder = canCreate && ['draft', 'pending'].includes(order.status);
    const canRetryOrder = canCreate && order.status === 'failed';
    const canEditOrder = canCreate && ['draft', 'pending'].includes(order.status);
    const canDeleteOrder = canCreate && ['draft', 'cancelled'].includes(order.status);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[450px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Chi tiết đơn hàng #{order.order_index}</SheetTitle>
                    <SheetDescription>
                        Batch: {order.batch_id}
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Trạng thái</span>
                        <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                        </Badge>
                    </div>

                    {/* Error message */}
                    {order.status === 'failed' && order.error_message && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                                <AlertTriangle className="h-4 w-4" />
                                Lỗi
                            </div>
                            <p className="text-sm text-red-600 mt-1">{order.error_message}</p>
                        </div>
                    )}

                    <Separator />

                    {/* Customer info */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Khách hàng</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-muted-foreground">Tên:</span>
                            <span className="font-medium">{order.customer_name}</span>
                            <span className="text-muted-foreground">SĐT:</span>
                            <span className="font-medium">{order.customer_phone}</span>
                            <span className="text-muted-foreground">ID:</span>
                            <span className="font-medium">{order.customer_id}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* Products */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Sản phẩm ({products.length})</h4>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SP ID</TableHead>
                                    <TableHead className="text-right">SL</TableHead>
                                    <TableHead className="text-right">Đơn giá</TableHead>
                                    <TableHead className="text-right">Thành tiền</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((p: any) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-mono text-xs">{p.id}</TableCell>
                                        <TableCell className="text-right">{p.quantity}</TableCell>
                                        <TableCell className="text-right">{p.price?.toLocaleString('vi-VN')} ₫</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {((p.quantity || 0) * (p.price || 0)).toLocaleString('vi-VN')} ₫
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Separator />

                    {/* Amount & Time */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Tổng tiền:</span>
                        <span className="font-semibold text-right">{order.total_amount?.toLocaleString('vi-VN')} ₫</span>
                        <span className="text-muted-foreground">Thời gian dự kiến:</span>
                        <span className="text-right">{order.scheduled_time ? new Date(order.scheduled_time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-'}</span>
                        <span className="text-muted-foreground">Tạo lúc:</span>
                        <span className="text-right">{order.created_at ? new Date(order.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-'}</span>
                        {order.bill_id && (
                            <>
                                <span className="text-muted-foreground">Bill ID (NhanhVN):</span>
                                <span className="text-right font-mono">{order.bill_id}</span>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    {(canEditOrder || canCancelOrder || canDeleteOrder || canRetryOrder) && (
                        <>
                            <Separator />
                            <div className="flex gap-2">
                                {canEditOrder && onEdit && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { onEdit(order); onOpenChange(false); }}
                                    >
                                        <Pencil className="mr-1 h-4 w-4" />
                                        Sửa đơn
                                    </Button>
                                )}
                                {canCancelOrder && onCancel && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => { onCancel(order.id); onOpenChange(false); }}
                                    >
                                        <XCircle className="mr-1 h-4 w-4" />
                                        Hủy đơn
                                    </Button>
                                )}
                                {canRetryOrder && onRetry && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { onRetry(order.id); onOpenChange(false); }}
                                    >
                                        <RotateCcw className="mr-1 h-4 w-4" />
                                        Thử lại
                                    </Button>
                                )}
                                {canDeleteOrder && onDelete && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                            >
                                                <Trash2 className="mr-1 h-4 w-4" />
                                                Xóa đơn
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Xác nhận xóa đơn hàng</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Bạn sẽ xóa vĩnh viễn đơn hàng #{order.order_index}. Hành động này không thể hoàn tác.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-red-600 hover:bg-red-700"
                                                    onClick={() => { onDelete(order.id); onOpenChange(false); }}
                                                >
                                                    Xóa đơn
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};
