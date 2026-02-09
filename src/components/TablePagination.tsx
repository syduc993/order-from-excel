import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

interface TablePaginationProps {
    page: number; // 1-indexed
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    itemLabel?: string;
}

export function TablePagination({
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    itemLabel = 'mục',
}: TablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    if (totalItems === 0) return null;

    return (
        <div className="flex items-center justify-between mt-4 pt-3 border-t gap-4 flex-wrap">
            {/* Left: info + page size */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                    {startItem}–{endItem} / {totalItems} {itemLabel}
                </span>
                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5">
                        <span className="hidden sm:inline">Hiển thị</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(v) => onPageSizeChange(Number(v))}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="hidden sm:inline">/ trang</span>
                    </div>
                )}
            </div>

            {/* Right: navigation */}
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onPageChange(1)}
                    disabled={page <= 1}
                    title="Trang đầu"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    title="Trang trước"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-sm font-medium whitespace-nowrap">
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    title="Trang sau"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onPageChange(totalPages)}
                    disabled={page >= totalPages}
                    title="Trang cuối"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
