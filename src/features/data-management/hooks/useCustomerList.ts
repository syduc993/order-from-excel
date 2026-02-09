import { useState, useCallback, useRef } from 'react';
import { getSupabaseService } from '@/services/supabase';
import { CustomerList, CustomerListItem, CustomerListItemInsert } from '@/types/dataManagement';
import { toast } from 'sonner';

export function useCustomerList() {
    const [list, setList] = useState<CustomerList | null>(null);
    const [items, setItems] = useState<CustomerListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Track current pagination params for reload
    const paginationRef = useRef({ page: 1, pageSize: 10, search: '' });

    /** Initialize: get or create the default list and load first page */
    const init = useCallback(async (createdBy?: string) => {
        const service = getSupabaseService();
        if (!service) return;

        setIsLoading(true);
        try {
            const defaultList = await service.getOrCreateDefaultCustomerList(createdBy);
            setList(defaultList);
            const { page, pageSize, search } = paginationRef.current;
            const result = await service.getCustomerItemsPage(defaultList.id, page, pageSize, search || undefined);
            setItems(result.items);
            setTotalCount(result.totalCount);
        } catch (error) {
            toast.error(`Lỗi tải danh sách khách hàng: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /** Load a specific page with optional search */
    const loadPage = useCallback(async (page: number, pageSize: number, search?: string) => {
        if (!list) return;
        const service = getSupabaseService();
        if (!service) return;

        paginationRef.current = { page, pageSize, search: search || '' };
        setIsLoading(true);
        try {
            const [updatedList, result] = await Promise.all([
                service.getOrCreateDefaultCustomerList(),
                service.getCustomerItemsPage(list.id, page, pageSize, search || undefined),
            ]);
            setList(updatedList);
            setItems(result.items);
            setTotalCount(result.totalCount);
        } catch (error) {
            toast.error(`Lỗi tải dữ liệu: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, [list]);

    /** Reload current page */
    const reload = useCallback(async () => {
        const { page, pageSize, search } = paginationRef.current;
        await loadPage(page, pageSize, search || undefined);
    }, [loadPage]);

    /** Bulk import from parsed Excel data */
    const bulkImport = useCallback(async (
        insertItems: CustomerListItemInsert[],
        onProgress?: (processed: number, total: number) => void,
    ) => {
        if (!list) return 0;
        const service = getSupabaseService();
        if (!service) return 0;

        try {
            const result = await service.upsertCustomerItems(list.id, insertItems, onProgress);
            await reload();
            return result.inserted;
        } catch (error) {
            toast.error(`Lỗi import: ${(error as Error).message}`);
            return 0;
        }
    }, [list, reload]);

    /** Add single customer */
    const addItem = useCallback(async (item: CustomerListItemInsert) => {
        if (!list) return;
        const service = getSupabaseService();
        if (!service) return;

        try {
            await service.addCustomerItem(list.id, item);
            await reload();
            toast.success('Đã thêm khách hàng');
        } catch (error) {
            toast.error(`Lỗi thêm: ${(error as Error).message}`);
        }
    }, [list, reload]);

    /** Update single customer */
    const updateItem = useCallback(async (itemId: number, updates: Partial<CustomerListItemInsert>) => {
        const service = getSupabaseService();
        if (!service) return;

        try {
            await service.updateCustomerItem(itemId, updates);
            await reload();
            toast.success('Đã cập nhật');
        } catch (error) {
            toast.error(`Lỗi cập nhật: ${(error as Error).message}`);
        }
    }, [reload]);

    /** Delete single customer */
    const deleteItem = useCallback(async (itemId: number) => {
        const service = getSupabaseService();
        if (!service) return;

        try {
            await service.deleteCustomerItem(itemId);
            await reload();
            toast.success('Đã xóa');
        } catch (error) {
            toast.error(`Lỗi xóa: ${(error as Error).message}`);
        }
    }, [reload]);

    /** Delete multiple customers */
    const deleteItems = useCallback(async (itemIds: number[]) => {
        const service = getSupabaseService();
        if (!service) return 0;

        try {
            const count = await service.deleteCustomerItems(itemIds);
            await reload();
            toast.success(`Đã xóa ${count} khách hàng`);
            return count;
        } catch (error) {
            toast.error(`Lỗi xóa: ${(error as Error).message}`);
            return 0;
        }
    }, [reload]);

    return {
        list,
        items,
        totalCount,
        isLoading,
        init,
        loadPage,
        reload,
        bulkImport,
        addItem,
        updateItem,
        deleteItem,
        deleteItems,
    };
}
