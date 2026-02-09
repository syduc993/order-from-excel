import { useState, useEffect } from 'react';
import { CustomerListItem } from '@/types/dataManagement';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Search } from 'lucide-react';
import { TablePagination } from '@/components/TablePagination';

interface ItemsTableProps {
    items: CustomerListItem[];
    totalItems: number;
    isLoading?: boolean;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
    onEdit: (item: CustomerListItem) => void;
    onDelete: (itemId: number) => void;
    onPageChange: (page: number, pageSize: number, search?: string) => void;
}

export function ItemsTable({ items, totalItems, isLoading, selectedIds, onSelectionChange, onEdit, onDelete, onPageChange }: ItemsTableProps) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            onPageChange(1, pageSize, search || undefined);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        onPageChange(newPage, pageSize, search || undefined);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
        onPageChange(1, newSize, search || undefined);
    };

    const allPageIds = items.map((i) => i.id!).filter(Boolean);
    const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.includes(id));

    const toggleAll = () => {
        if (allSelected) {
            onSelectionChange(selectedIds.filter((id) => !allPageIds.includes(id)));
        } else {
            const newIds = new Set([...selectedIds, ...allPageIds]);
            onSelectionChange(Array.from(newIds));
        }
    };

    const toggleOne = (id: number) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((x) => x !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    return (
        <div className="space-y-3">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Tìm theo tên, SĐT, hoặc ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Table */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                            </TableHead>
                            <TableHead className="w-24">ID KH</TableHead>
                            <TableHead>Họ Tên</TableHead>
                            <TableHead>Điện Thoại</TableHead>
                            <TableHead className="w-24 text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                    Đang tải...
                                </TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                    {totalItems === 0 && !search ? 'Chưa có khách hàng nào. Import file Excel hoặc thêm thủ công.' : 'Không tìm thấy kết quả.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.includes(item.id!)}
                                            onCheckedChange={() => toggleOne(item.id!)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{item.customer_ext_id}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.phone}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(item.id!)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <TablePagination
                page={page}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                itemLabel="khách hàng"
            />
        </div>
    );
}
