import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, Package } from 'lucide-react';
import { InventoryValidationResult } from '@/types/inventoryTypes';
import { Badge } from '@/components/ui/badge';

interface InventoryCheckDialogProps {
    open: boolean;
    result: InventoryValidationResult | null;
    onContinueWithExcel: () => void;
    onUseActualInventory: () => void;
    onCancel: () => void;
}

export const InventoryCheckDialog = ({
    open,
    result,
    onContinueWithExcel,
    onUseActualInventory,
    onCancel,
}: InventoryCheckDialogProps) => {
    if (!result) return null;

    const { allSufficient, checks, totalProducts, insufficientCount, outOfStockCount } = result;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'sufficient':
                return <CheckCircle2 className="w-4 h-4 text-green-600" />;
            case 'insufficient':
                return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
            case 'out_of_stock':
                return <XCircle className="w-4 h-4 text-red-600" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sufficient':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">✓ Đủ hàng</Badge>;
            case 'insufficient':
                return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">⚠ Thiếu</Badge>;
            case 'out_of_stock':
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">❌ Hết</Badge>;
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Kiểm Tra Tồn Kho
                    </DialogTitle>
                    <DialogDescription>
                        So sánh số lượng trong file Excel với tồn kho thực tế trên NhanhVN
                    </DialogDescription>
                </DialogHeader>

                {/* Summary Statistics */}
                <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                        <div className="text-sm text-muted-foreground">Tổng số SP</div>
                        <div className="text-2xl font-bold">{totalProducts}</div>
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">Đủ hàng</div>
                        <div className="text-2xl font-bold text-green-600">
                            {totalProducts - insufficientCount - outOfStockCount}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">Thiếu hàng</div>
                        <div className="text-2xl font-bold text-yellow-600">{insufficientCount}</div>
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">Hết hàng</div>
                        <div className="text-2xl font-bold text-red-600">{outOfStockCount}</div>
                    </div>
                </div>

                {/* Warning Alert */}
                {!allSufficient && (
                    <Alert variant="destructive" className="bg-yellow-50 border-yellow-200">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertTitle className="text-yellow-800">Cảnh báo tồn kho không đủ</AlertTitle>
                        <AlertDescription className="text-yellow-700">
                            Có {insufficientCount + outOfStockCount} sản phẩm không đủ tồn kho.
                            {insufficientCount > 0 && ` ${insufficientCount} sản phẩm thiếu hàng.`}
                            {outOfStockCount > 0 && ` ${outOfStockCount} sản phẩm hết hàng.`}
                            <br />
                            <strong>Khuyến nghị:</strong> Sử dụng tồn kho thực tế để tránh lỗi khi tạo đơn.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Success Alert */}
                {allSufficient && (
                    <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Tồn kho đủ</AlertTitle>
                        <AlertDescription className="text-green-700">
                            Tất cả sản phẩm đều có đủ tồn kho. Bạn có thể tiếp tục với số lượng ban đầu.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Product Table */}
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">STT</TableHead>
                                <TableHead>Sản Phẩm</TableHead>
                                <TableHead className="text-right">
                                    <div className="flex flex-col">
                                        <span>Excel</span>
                                        {checks.some(c => c.initialQuantity !== undefined) && (
                                            <span className="text-xs font-normal text-muted-foreground">(Còn lại)</span>
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right">Tồn Thực</TableHead>
                                <TableHead className="text-right">Chênh Lệch</TableHead>
                                <TableHead>Trạng Thái</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {checks.map((check, index) => {
                                const diff = check.actualInventory - check.excelQuantity;
                                const hasAdjustmentInfo = check.initialQuantity !== undefined && check.usedQuantity !== undefined;
                                return (
                                    <TableRow
                                        key={check.productId}
                                        className={
                                            check.status === 'out_of_stock' ? 'bg-red-50' :
                                                check.status === 'insufficient' ? 'bg-yellow-50' :
                                                    ''
                                        }
                                    >
                                        <TableCell className="font-medium">{index + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(check.status)}
                                                <div>
                                                    <div className="font-medium">{check.productName}</div>
                                                    <div className="text-xs text-muted-foreground">ID: {check.productId}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium">{check.excelQuantity.toLocaleString()}</span>
                                                {hasAdjustmentInfo && (
                                                    <div className="text-xs text-muted-foreground">
                                                        <span>Ban đầu: {check.initialQuantity!.toLocaleString()}</span>
                                                        {check.usedQuantity! > 0 && (
                                                            <span className="text-red-600"> - Đã dùng: {check.usedQuantity!.toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <span className={
                                                check.status === 'out_of_stock' ? 'text-red-600' :
                                                    check.status === 'insufficient' ? 'text-yellow-600' :
                                                        'text-green-600'
                                            }>
                                                {check.actualInventory.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={diff < 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                                                {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(check.status)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Hủy
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onUseActualInventory}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Sử dụng tồn kho thực tế
                    </Button>
                    <Button
                        onClick={onContinueWithExcel}
                        disabled={!allSufficient}
                        className={allSufficient ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                        {allSufficient ? 'Tiếp tục với số lượng ban đầu' : 'Không thể tiếp tục (thiếu hàng)'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
