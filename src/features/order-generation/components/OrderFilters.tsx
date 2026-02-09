import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/DatePicker';
import { Search, X, Filter } from 'lucide-react';
import { getStatusColor, getStatusText, ALL_STATUSES } from '@/utils/orderUtils';

export interface OrderFilterValues {
    searchText: string;
    statuses: string[];
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
}

interface OrderFiltersProps {
    filters: OrderFilterValues;
    onFiltersChange: (filters: OrderFilterValues) => void;
    onApply: () => void;
}

export const OrderFilters = ({ filters, onFiltersChange, onApply }: OrderFiltersProps) => {
    const [localSearch, setLocalSearch] = useState(filters.searchText);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== filters.searchText) {
                onFiltersChange({ ...filters, searchText: localSearch });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch, filters, onFiltersChange]);

    const toggleStatus = (status: string) => {
        const newStatuses = filters.statuses.includes(status)
            ? filters.statuses.filter(s => s !== status)
            : [...filters.statuses, status];
        const newFilters = { ...filters, statuses: newStatuses };
        onFiltersChange(newFilters);
    };

    const clearFilters = () => {
        setLocalSearch('');
        onFiltersChange({ searchText: '', statuses: [], dateFrom: undefined, dateTo: undefined });
    };

    const hasFilters = filters.searchText || filters.statuses.length > 0 || filters.dateFrom || filters.dateTo;

    return (
        <div className="space-y-3">
            {/* Search + Date range */}
            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Tìm theo tên hoặc SĐT khách hàng..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                <DatePicker
                    date={filters.dateFrom}
                    onDateChange={(d) => onFiltersChange({ ...filters, dateFrom: d || undefined })}
                    placeholder="Từ ngày"
                />
                <DatePicker
                    date={filters.dateTo}
                    onDateChange={(d) => onFiltersChange({ ...filters, dateTo: d || undefined })}
                    placeholder="Đến ngày"
                />
                <Button size="sm" onClick={onApply}>
                    <Filter className="mr-1 h-3 w-3" />
                    Lọc
                </Button>
                {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-1 h-3 w-3" />
                        Xóa lọc
                    </Button>
                )}
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5">
                {ALL_STATUSES.map(status => {
                    const isSelected = filters.statuses.includes(status);
                    return (
                        <Badge
                            key={status}
                            variant={isSelected ? 'default' : 'outline'}
                            className={`cursor-pointer select-none transition-colors ${isSelected ? getStatusColor(status) + ' border' : 'hover:bg-muted'}`}
                            onClick={() => toggleStatus(status)}
                        >
                            {getStatusText(status)}
                        </Badge>
                    );
                })}
            </div>
        </div>
    );
};
