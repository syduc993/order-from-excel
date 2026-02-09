import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/DatePicker';
import { Layers, Loader2, Filter, Copy, Check, Trash2 } from 'lucide-react';
import { TablePagination } from '@/components/TablePagination';
import { getSupabaseService } from '@/services/supabase';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BatchRow {
    id: string;
    start_date: string;
    end_date: string;
    total_orders: number;
    status: string;
    created_at: string;
    computed_status: string;
    completed_count: number;
    failed_count: number;
    pending_count: number;
}

const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    processing: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-amber-100 text-amber-800',
    draft: 'bg-purple-100 text-purple-800',
    failed: 'bg-red-100 text-red-800',
    partial: 'bg-orange-100 text-orange-800',
};

const statusLabels: Record<string, string> = {
    completed: 'Hoàn thành',
    processing: 'Đang xử lý',
    pending: 'Chờ xử lý',
    draft: 'Nháp',
    failed: 'Lỗi',
    partial: 'Một phần',
};

const Batches = () => {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<BatchRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Date filter - default to last 30 days
    const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
    });
    const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(() => new Date());

    const loadBatches = useCallback(async (page: number, size: number = pageSize) => {
        try {
            setIsLoading(true);
            const service = getSupabaseService();
            if (!service) {
                toast.error('Supabase chưa được cấu hình');
                setIsLoading(false);
                return;
            }
            const result = await service.getRecentBatchesWithStatus({
                limit: size,
                offset: (page - 1) * size,
                startDate: filterStartDate?.toISOString().split('T')[0],
                endDate: filterEndDate?.toISOString().split('T')[0],
            });
            setBatches(result.batches);
            setTotalCount(result.totalCount);
        } catch (error) {
            toast.error(`Lỗi tải danh sách batch: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, [filterStartDate, filterEndDate]);

    useEffect(() => {
        loadBatches(currentPage, pageSize);
    }, [currentPage, pageSize, loadBatches]);

    const handleFilter = () => {
        setCurrentPage(1);
        loadBatches(1);
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
        });
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh',
        });
    };

    const getDisplayId = (id: string) => {
        // batch_1770570735719 -> #1770570735719
        const numPart = id.replace('batch_', '');
        return `#${numPart}`;
    };

    const handleCopyId = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const getStatusBreakdown = (batch: BatchRow) => {
        const actual = batch.completed_count + batch.failed_count + batch.pending_count;
        if (actual === 0) return '0 đơn';
        const parts: string[] = [];
        if (batch.completed_count > 0) parts.push(`${batch.completed_count} OK`);
        if (batch.failed_count > 0) parts.push(`${batch.failed_count} lỗi`);
        if (batch.pending_count > 0) parts.push(`${batch.pending_count} chờ`);
        return `${parts.join(', ')} / ${actual}`;
    };

    const handleDeleteClick = (e: React.MouseEvent, batchId: string) => {
        e.stopPropagation();
        setDeletingBatchId(batchId);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingBatchId) return;
        setIsDeleting(true);
        try {
            const service = getSupabaseService();
            if (!service) {
                toast.error('Supabase chưa được cấu hình');
                return;
            }
            const result = await service.deleteBatch(deletingBatchId);
            toast.success(`Đã xóa batch và ${result.deletedOrders} đơn hàng`);
            await loadBatches(currentPage);
        } catch (error) {
            toast.error(`Lỗi xóa batch: ${(error as Error).message}`);
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setDeletingBatchId(null);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-6xl">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Layers className="h-8 w-8" />
                    Quản Lý Batch
                </h1>
                <p className="text-muted-foreground">
                    Xem tất cả batch đã tạo, click vào batch để xem phân tích chi tiết
                </p>
            </div>

            {/* Date Filter */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Bộ Lọc
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-1">
                            <Label className="text-sm">Từ ngày</Label>
                            <DatePicker
                                date={filterStartDate}
                                onDateChange={setFilterStartDate}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-sm">Đến ngày</Label>
                            <DatePicker
                                date={filterEndDate}
                                onDateChange={setFilterEndDate}
                            />
                        </div>
                        <Button onClick={handleFilter} size="sm">
                            Lọc
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Danh sách Batch</CardTitle>
                    <CardDescription>
                        {totalCount} batch {filterStartDate || filterEndDate ? '(đã lọc)' : 'tổng cộng'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-muted-foreground">Đang tải...</span>
                        </div>
                    ) : batches.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Chưa có batch nào. Tạo đơn hàng để bắt đầu.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left">
                                                <th className="pb-3 font-medium text-muted-foreground">Batch</th>
                                                <th className="pb-3 font-medium text-muted-foreground">Ngày tạo</th>
                                                <th className="pb-3 font-medium text-muted-foreground">Khoảng ngày</th>
                                                <th className="pb-3 font-medium text-muted-foreground text-right">Số đơn</th>
                                                <th className="pb-3 font-medium text-muted-foreground text-center">Trạng thái</th>
                                                <th className="pb-3 font-medium text-muted-foreground">Chi tiết</th>
                                                <th className="pb-3 font-medium text-muted-foreground text-center">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batches.map((batch) => (
                                                <tr
                                                    key={batch.id}
                                                    className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                                                    onClick={() => navigate(`/batch-analysis/${batch.id}`)}
                                                >
                                                    <td className="py-3">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-mono text-xs font-medium break-all">
                                                                {getDisplayId(batch.id)}
                                                            </span>
                                                            <button
                                                                className="p-0.5 rounded hover:bg-muted shrink-0"
                                                                onClick={(e) => handleCopyId(e, batch.id)}
                                                            >
                                                                {copiedId === batch.id ? (
                                                                    <Check className="h-3 w-3 text-green-600" />
                                                                ) : (
                                                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-3">{formatDateTime(batch.created_at)}</td>
                                                    <td className="py-3">
                                                        {formatDate(batch.start_date)} — {formatDate(batch.end_date)}
                                                    </td>
                                                    <td className="py-3 text-right font-medium">{batch.total_orders.toLocaleString()}</td>
                                                    <td className="py-3 text-center">
                                                        {batch.computed_status !== 'empty' ? (
                                                            <Badge
                                                                variant="secondary"
                                                                className={statusColors[batch.computed_status] || 'bg-gray-100 text-gray-800'}
                                                            >
                                                                {statusLabels[batch.computed_status] || batch.computed_status}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-xs text-muted-foreground">
                                                        {getStatusBreakdown(batch)}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => handleDeleteClick(e, batch.id)}
                                                            disabled={isDeleting}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                            </div>

                            {/* Pagination */}
                            <TablePagination
                                page={currentPage}
                                pageSize={pageSize}
                                totalItems={totalCount}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={(size) => {
                                    setPageSize(size);
                                    setCurrentPage(1);
                                }}
                                itemLabel="batch"
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa batch</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn sắp xóa vĩnh viễn batch <strong>{(deletingBatchId || '').slice(0, 8)}</strong> và tất cả đơn hàng liên quan.
                            Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang xóa...
                                </>
                            ) : (
                                'Xóa batch'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Batches;
