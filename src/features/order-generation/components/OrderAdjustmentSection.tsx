import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/DatePicker';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { SupabaseService } from '@/services/supabase';
import { env } from '@/config/env';

interface RecentBatch {
    id: string;
    start_date: string;
    end_date: string;
    total_orders: number;
    status: string;
    created_at: string;
}

interface OrderAdjustmentSectionProps {
    batchId: string;
    adjustConfig: {
        batchId: string;
        adjustFromDate: Date | null;
        adjustEndDate: Date | null;
        newTotalOrders: number;
    };
    setAdjustConfig: (config: any) => void;
    onAdjust: () => void;
    isProcessing: boolean;
    onLoadStats: (batchId: string) => void;
}

export const OrderAdjustmentSection = ({
    batchId,
    adjustConfig,
    setAdjustConfig,
    onAdjust,
    isProcessing,
    onLoadStats,
}: OrderAdjustmentSectionProps) => {
    const [recentBatches, setRecentBatches] = useState<RecentBatch[]>([]);
    const [isLoadingBatches, setIsLoadingBatches] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Load recent batches on mount
    useEffect(() => {
        const loadRecentBatches = async () => {
            if (!env.supabase.url || !env.supabase.anonKey) return;
            setIsLoadingBatches(true);
            try {
                const supabase = new SupabaseService({ url: env.supabase.url, key: env.supabase.anonKey });
                const batches = await supabase.getRecentBatches(20);
                setRecentBatches(batches);
            } catch (error) {
                console.error('Failed to load recent batches:', error);
            } finally {
                setIsLoadingBatches(false);
            }
        };
        loadRecentBatches();
    }, []);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    };

    const handleConfirmAdjust = () => {
        setShowConfirmDialog(false);
        onAdjust();
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Điều Chỉnh Đơn Hàng</CardTitle>
                    <CardDescription>Điều chỉnh số lượng đơn hàng từ một ngày cụ thể trở đi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Batch</Label>
                        <div className="flex gap-2">
                            {recentBatches.length > 0 ? (
                                <Select
                                    value={adjustConfig.batchId}
                                    onValueChange={(value) => {
                                        setAdjustConfig({ ...adjustConfig, batchId: value });
                                        onLoadStats(value);
                                    }}
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Chọn batch..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {recentBatches.map((batch) => (
                                            <SelectItem key={batch.id} value={batch.id}>
                                                <span className="flex items-center gap-2">
                                                    <span className="font-mono text-xs">{batch.id.slice(0, 8)}</span>
                                                    <span className="text-muted-foreground">|</span>
                                                    <span>{formatDate(batch.created_at)}</span>
                                                    <span className="text-muted-foreground">|</span>
                                                    <span>{batch.total_orders} đơn</span>
                                                    <span className={
                                                        batch.status === 'completed' ? 'text-green-600' :
                                                        batch.status === 'processing' ? 'text-blue-600' :
                                                        'text-yellow-600'
                                                    }>
                                                        ({batch.status})
                                                    </span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    className="flex-1"
                                    placeholder="Nhập Batch ID..."
                                    value={adjustConfig.batchId}
                                    onChange={(e) => setAdjustConfig({ ...adjustConfig, batchId: e.target.value })}
                                />
                            )}
                            <Button
                                variant="outline"
                                onClick={() => onLoadStats(adjustConfig.batchId)}
                                disabled={!adjustConfig.batchId}
                            >
                                Xem Thống Kê
                            </Button>
                        </div>
                    </div>

                    {batchId && (
                        <div className="p-4 border rounded-lg bg-blue-50 space-y-4">
                            <div className="flex items-center gap-2 text-blue-700 font-medium">
                                <AlertTriangle className="h-5 w-5" />
                                <span>Khu vực nguy hiểm: Thay đổi lịch trình đơn hàng</span>
                            </div>
                            <p className="text-sm text-blue-600">
                                Chức năng này sẽ <strong>HỦY</strong> tất cả các đơn hàng chưa chạy (pending) từ ngày được chọn,
                                sau đó tính toán lại tồn kho và tạo lại các đơn hàng mới phân bổ đều cho đến ngày kết thúc.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Điều chỉnh từ ngày (Bắt buộc)</Label>
                                    <DatePicker
                                        date={adjustConfig.adjustFromDate || undefined}
                                        onDateChange={(date) => setAdjustConfig({ ...adjustConfig, adjustFromDate: date || null })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ngày kết thúc mới (Tùy chọn)</Label>
                                    <DatePicker
                                        date={adjustConfig.adjustEndDate || undefined}
                                        onDateChange={(date) => setAdjustConfig({ ...adjustConfig, adjustEndDate: date || null })}
                                    />
                                    <p className="text-xs text-gray-500">
                                        Để trống nếu muốn giữ nguyên ngày kết thúc cũ
                                    </p>
                                </div>
                            </div>

                            <Button
                                className="w-full"
                                variant="destructive"
                                onClick={() => setShowConfirmDialog(true)}
                                disabled={isProcessing || !adjustConfig.adjustFromDate}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Đang xử lý...
                                    </>
                                ) : (
                                    'Xác nhận điều chỉnh & Tạo lại đơn hàng'
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận điều chỉnh đơn hàng</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>
                                    Thao tác này sẽ <strong className="text-red-600">HỦY</strong> tất cả đơn hàng pending
                                    từ ngày <strong>{adjustConfig.adjustFromDate?.toLocaleDateString('vi-VN')}</strong> trở đi.
                                </p>
                                <p>Sau đó hệ thống sẽ tính toán lại tồn kho và tạo lại đơn hàng mới.</p>
                                <p className="text-red-600 font-medium">Bạn có chắc chắn muốn tiếp tục?</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAdjust}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Xác nhận điều chỉnh
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
