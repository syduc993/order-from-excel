import { useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseService } from '@/services/supabase';

export const useOrderData = () => {
    const [batchStats, setBatchStats] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [ordersPagination, setOrdersPagination] = useState<{
        page: number;
        pageSize: number;
        totalPages: number;
        count: number;
    } | null>(null);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);

    const loadOrders = async (
        batchId: string,
        page: number = 1,
        pageSize: number = 10,
        filters?: {
            statuses?: string[];
            searchText?: string;
            dateFrom?: Date;
            dateTo?: Date;
        }
    ) => {
        const supabaseService = getSupabaseService();
        if (!supabaseService) return;

        setIsLoadingOrders(true);
        try {
            const result = await supabaseService.getOrders(batchId, {
                page,
                pageSize,
                statuses: filters?.statuses,
                searchText: filters?.searchText,
                dateFrom: filters?.dateFrom,
                dateTo: filters?.dateTo,
            });

            setOrders(result.data);
            setOrdersPagination({
                page: result.page,
                pageSize: result.pageSize,
                totalPages: result.totalPages,
                count: result.count,
            });
        } catch (error) {
            toast.error(`Lỗi khi tải danh sách đơn hàng: ${(error as Error).message}`);
        } finally {
            setIsLoadingOrders(false);
        }
    };

    const loadBatchStats = async (batchId: string) => {
        const supabaseService = getSupabaseService();
        if (!supabaseService) {
            toast.error('Vui lòng cấu hình Supabase trong file .env');
            return;
        }

        try {
            const stats = await supabaseService.getBatchStats(batchId);
            const batch = await supabaseService.getBatch(batchId);
            setBatchStats({ ...stats, batch });
            toast.success('Đã tải thống kê batch thành công');

            // Tự động load danh sách đơn hàng
            await loadOrders(batchId, 1);
        } catch (error) {
            toast.error(`Lỗi: ${(error as Error).message}`);
        }
    };

    return {
        batchStats,
        orders,
        ordersPagination,
        isLoadingOrders,
        loadBatchStats,
        loadOrders,
    };
};
