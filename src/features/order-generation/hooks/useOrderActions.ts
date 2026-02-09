import { useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseService } from '@/services/supabase';

export const useOrderActions = (onRefresh: () => void) => {
    const [isLoading, setIsLoading] = useState(false);
    const [actionOrderId, setActionOrderId] = useState<number | null>(null);

    const getService = () => {
        const service = getSupabaseService();
        if (!service) throw new Error('Supabase chưa được cấu hình');
        return service;
    };

    const cancelOrder = async (orderId: number) => {
        setIsLoading(true);
        setActionOrderId(orderId);
        try {
            const service = getService();
            await service.cancelOrder(orderId);
            toast.success('Đã hủy đơn hàng');
            onRefresh();
        } catch (error) {
            toast.error(`Lỗi hủy đơn: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
            setActionOrderId(null);
        }
    };

    const retryOrder = async (orderId: number) => {
        setIsLoading(true);
        setActionOrderId(orderId);
        try {
            const service = getService();
            await service.retryFailedOrder(orderId);
            toast.success('Đã đưa đơn hàng vào hàng đợi để thử lại');
            onRefresh();
        } catch (error) {
            toast.error(`Lỗi retry: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
            setActionOrderId(null);
        }
    };

    const approveAllDrafts = async (batchId: string) => {
        setIsLoading(true);
        try {
            const service = getService();
            const count = await service.approveAllDraftOrders(batchId);
            toast.success(`Đã duyệt ${count} đơn hàng nháp`);
            onRefresh();
            return count;
        } catch (error) {
            toast.error(`Lỗi duyệt đơn: ${(error as Error).message}`);
            return 0;
        } finally {
            setIsLoading(false);
        }
    };

    const approveSelected = async (orderIds: number[]) => {
        setIsLoading(true);
        try {
            const service = getService();
            const count = await service.approveSelectedOrders(orderIds);
            toast.success(`Đã duyệt ${count} đơn hàng`);
            onRefresh();
            return count;
        } catch (error) {
            toast.error(`Lỗi duyệt đơn: ${(error as Error).message}`);
            return 0;
        } finally {
            setIsLoading(false);
        }
    };

    const editOrder = async (orderId: number, updates: any) => {
        setIsLoading(true);
        setActionOrderId(orderId);
        try {
            const service = getService();
            await service.updateOrder(orderId, updates);
            toast.success('Đã cập nhật đơn hàng');
            onRefresh();
        } catch (error) {
            toast.error(`Lỗi cập nhật: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
            setActionOrderId(null);
        }
    };

    const deleteOrder = async (orderId: number) => {
        setIsLoading(true);
        setActionOrderId(orderId);
        try {
            const service = getService();
            await service.deleteOrder(orderId);
            toast.success('Đã xóa đơn hàng');
            onRefresh();
        } catch (error) {
            toast.error(`Lỗi xóa đơn: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
            setActionOrderId(null);
        }
    };

    const deleteOrders = async (orderIds: number[]) => {
        setIsLoading(true);
        try {
            const service = getService();
            const count = await service.deleteOrders(orderIds);
            toast.success(`Đã xóa ${count} đơn hàng`);
            onRefresh();
            return count;
        } catch (error) {
            toast.error(`Lỗi xóa đơn: ${(error as Error).message}`);
            return 0;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        actionOrderId,
        cancelOrder,
        retryOrder,
        approveAllDrafts,
        approveSelected,
        editOrder,
        deleteOrder,
        deleteOrders,
    };
};
