import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, Package, Search, ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck } from 'lucide-react';
import { InventoryValidationResult, InventoryCheckResult } from '@/types/inventoryTypes';
import { Badge } from '@/components/ui/badge';
import { TablePagination } from '@/components/TablePagination';

type StatusFilter = 'all' | 'sufficient' | 'insufficient' | 'out_of_stock';
type SortField = 'name' | 'excel' | 'inventory' | 'diff' | 'status';
type SortDir = 'asc' | 'desc';

interface InventoryCheckDialogProps {
    open: boolean;
    result: InventoryValidationResult | null;
    mode?: 'preview' | 'action';
    onContinueWithExcel: () => void;
    onUseActualInventory: () => void;
    onCancel: () => void;
}

const STATUS_ORDER: Record<string, number> = { out_of_stock: 0, insufficient: 1, sufficient: 2 };

export const InventoryCheckDialog = ({
    open,
    result,
    mode = 'action',
    onContinueWithExcel,
    onUseActualInventory,
    onCancel,
}: InventoryCheckDialogProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const checks = result?.checks ?? [];

    const filteredAndSorted = useMemo(() => {
        let items = [...checks];

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            items = items.filter(c =>
                c.productName.toLowerCase().includes(q) ||
                String(c.productId).includes(q)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            items = items.filter(c => c.status === statusFilter);
        }

        // Sort
        if (sortField) {
            items.sort((a, b) => {
                let cmp = 0;
                switch (sortField) {
                    case 'name':
                        cmp = a.productName.localeCompare(b.productName, 'vi');
                        break;
                    case 'excel':
                        cmp = a.excelQuantity - b.excelQuantity;
                        break;
                    case 'inventory':
                        cmp = a.actualInventory - b.actualInventory;
                        break;
                    case 'diff':
                        cmp = (a.actualInventory - a.excelQuantity) - (b.actualInventory - b.excelQuantity);
                        break;
                    case 'status':
                        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
                        break;
                }
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        return items;
    }, [checks, searchQuery, statusFilter, sortField, sortDir]);

    if (!result) return null;

    const { allSufficient, totalProducts, insufficientCount, outOfStockCount } = result;
    const sufficientCount = totalProducts - insufficientCount - outOfStockCount;

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
        return sortDir === 'asc'
            ? <ArrowUp className="w-3 h-3 ml-1" />
            : <ArrowDown className="w-3 h-3 ml-1" />;
    };

    // Pagination
    const totalFiltered = filteredAndSorted.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedItems = filteredAndSorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    // Reset page when filters change
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setPage(1);
    };
    const handleStatusFilter = (filter: StatusFilter) => {
        setStatusFilter(filter);
        setPage(1);
    };
    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(1);
    };

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

    const filterButtons: { key: StatusFilter; label: string; count: number; activeClass: string; inactiveClass: string }[] = [
        { key: 'all', label: 'Tất cả', count: totalProducts, activeClass: 'bg-primary text-primary-foreground hover:bg-primary/90', inactiveClass: 'border-border text-foreground hover:bg-accent' },
        { key: 'sufficient', label: 'Đủ hàng', count: sufficientCount, activeClass: 'bg-green-600 text-white hover:bg-green-700', inactiveClass: 'border-green-300 text-green-700 hover:bg-green-50' },
        { key: 'insufficient', label: 'Thiếu hàng', count: insufficientCount, activeClass: 'bg-yellow-500 text-white hover:bg-yellow-600', inactiveClass: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' },
        { key: 'out_of_stock', label: 'Hết hàng', count: outOfStockCount, activeClass: 'bg-red-600 text-white hover:bg-red-700', inactiveClass: 'border-red-300 text-red-700 hover:bg-red-50' },
    ];

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className={`max-w-4xl max-h-[95vh] h-[95vh] flex flex-col ${mode === 'preview' ? '!bg-gray-200' : ''}`}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {mode === 'preview' ? (
                            <><Package className="w-5 h-5" /> Kết Quả Tồn Kho</>
                        ) : (
                            <><ShieldCheck className="w-5 h-5 text-blue-600" /> Xác Nhận Tạo Đơn Hàng</>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'preview'
                            ? 'Kết quả kiểm tra tồn kho sau khi upload sản phẩm'
                            : 'Chọn nguồn số lượng để tạo đơn hàng'}
                    </DialogDescription>
                </DialogHeader>

                {/* Action mode: decision banner */}
                {mode === 'action' && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <div>
                            <strong>Bước xác nhận trước khi tạo đơn.</strong>
                            {' '}Kiểm tra bảng bên dưới rồi chọn sử dụng số lượng từ Excel hoặc tồn kho thực tế.
                        </div>
                    </div>
                )}

                {/* Summary + Alert - compact row */}
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm">
                    <span>Tổng: <strong>{totalProducts}</strong></span>
                    <span className="text-green-600">Đủ: <strong>{sufficientCount}</strong></span>
                    <span className="text-yellow-600">Thiếu: <strong>{insufficientCount}</strong></span>
                    <span className="text-red-600">Hết: <strong>{outOfStockCount}</strong></span>
                    {!allSufficient && (
                        <>
                            <span className="mx-1 text-border">|</span>
                            <span className="text-yellow-700">
                                <AlertTriangle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                                Khuyến nghị dùng tồn kho thực tế
                            </span>
                        </>
                    )}
                    {allSufficient && (
                        <>
                            <span className="mx-1 text-border">|</span>
                            <span className="text-green-700">
                                <CheckCircle2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                                Tất cả đủ tồn kho
                            </span>
                        </>
                    )}
                </div>

                {/* Search + Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Tìm theo tên sản phẩm hoặc ID..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {filterButtons.map(fb => (
                            <Button
                                key={fb.key}
                                variant="outline"
                                size="sm"
                                className={statusFilter === fb.key ? fb.activeClass : fb.inactiveClass}
                                onClick={() => handleStatusFilter(fb.key)}
                            >
                                {fb.label}
                                <span className="ml-1.5 text-xs opacity-80">({fb.count})</span>
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Product Table */}
                <div className="border rounded-lg overflow-y-auto flex-1 min-h-0">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[50px]">STT</TableHead>
                                <TableHead>
                                    <button
                                        className="flex items-center hover:text-foreground transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        Sản Phẩm{getSortIcon('name')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                                        onClick={() => handleSort('excel')}
                                    >
                                        <div className="flex flex-col items-end">
                                            <span className="flex items-center">Excel{getSortIcon('excel')}</span>
                                            {checks.some(c => c.initialQuantity !== undefined) && (
                                                <span className="text-xs font-normal text-muted-foreground">(Còn lại)</span>
                                            )}
                                        </div>
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                                        onClick={() => handleSort('inventory')}
                                    >
                                        Tồn Thực{getSortIcon('inventory')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                                        onClick={() => handleSort('diff')}
                                    >
                                        Chênh Lệch{getSortIcon('diff')}
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button
                                        className="flex items-center hover:text-foreground transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        Trạng Thái{getSortIcon('status')}
                                    </button>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Không tìm thấy sản phẩm nào
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedItems.map((check, index) => {
                                    const diff = check.actualInventory - check.excelQuantity;
                                    const hasAdjustmentInfo = check.initialQuantity !== undefined && check.usedQuantity !== undefined;
                                    const globalIndex = (safePage - 1) * pageSize + index;
                                    return (
                                        <TableRow
                                            key={`${check.productId}-${globalIndex}`}
                                            className={
                                                check.status === 'out_of_stock' ? 'bg-red-50' :
                                                    check.status === 'insufficient' ? 'bg-yellow-50' :
                                                        ''
                                            }
                                        >
                                            <TableCell className="font-medium">{globalIndex + 1}</TableCell>
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
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <TablePagination
                    page={safePage}
                    pageSize={pageSize}
                    totalItems={totalFiltered}
                    onPageChange={setPage}
                    onPageSizeChange={handlePageSizeChange}
                    pageSizeOptions={[20, 50, 100]}
                    itemLabel="sản phẩm"
                />

                {mode === 'preview' ? (
                    <DialogFooter>
                        <Button variant="outline" onClick={onCancel}>
                            Đóng
                        </Button>
                    </DialogFooter>
                ) : (
                    <div className="flex items-center justify-between gap-3 p-4 -mx-6 -mb-6 mt-2 bg-slate-50 border-t rounded-b-lg">
                        <Button variant="ghost" size="sm" onClick={onCancel}>
                            Hủy
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                onClick={onContinueWithExcel}
                                variant="outline"
                                disabled={!allSufficient}
                            >
                                {allSufficient ? 'Dùng số lượng Excel' : 'Excel (thiếu hàng)'}
                            </Button>
                            <Button
                                onClick={onUseActualInventory}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Dùng tồn kho thực tế
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
