import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/DatePicker';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    return (
        <Card>
            <CardHeader>
                <CardTitle>Điều Chỉnh Đơn Hàng</CardTitle>
                <CardDescription>Điều chỉnh số lượng đơn hàng từ một ngày cụ thể trở đi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Batch ID</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nhập Batch ID..."
                            value={adjustConfig.batchId}
                            onChange={(e) => setAdjustConfig({ ...adjustConfig, batchId: e.target.value })}
                        />
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
                            onClick={onAdjust}
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
    );
};
