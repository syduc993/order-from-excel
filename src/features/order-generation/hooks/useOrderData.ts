import { useState } from 'react';
import { toast } from 'sonner';
import { SupabaseService } from '@/services/supabase';
import { env } from '@/config/env';

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
    const [ordersFilter, setOrdersFilter] = useState<{
        status?: string;
        orderBy?: string;
        ascending?: boolean;
    }>({});

    // Supabase configuration
    const supabaseConfig = (() => {
        if (env.supabase.url && env.supabase.anonKey) {
            return {
                url: env.supabase.url,
                key: env.supabase.anonKey,
            };
        }
        return null;
    })();

    const loadOrders = async (batchId: string, page: number = 1, pageSize: number = 5) => {
        if (!supabaseConfig) return;

        setIsLoadingOrders(true);
        try {
            const supabaseService = new SupabaseService(supabaseConfig);
            const result = await supabaseService.getOrders(batchId, {
                page,
                pageSize,
                ...ordersFilter,
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
        if (!supabaseConfig) {
            toast.error('Vui lòng cấu hình Supabase trong file .env');
            return;
        }

        try {
            const supabaseService = new SupabaseService(supabaseConfig);
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
        ordersFilter,
        setOrdersFilter,
        loadBatchStats,
        loadOrders,
    };
};
