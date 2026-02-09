import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product } from '@/types/excel';
import { ApiOrderRequest } from '@/types/api';
import { CustomerList, CustomerListItem, CustomerListItemInsert } from '@/types/dataManagement';
import {
    calculateStatusBreakdown,
    calculateHistogramCount,
    calculateHistogramAmount,
    calculateRevenueByDate,
    calculateRevenueByHour,
    calculateProductQuantityByDate
} from '@/utils/statsUtils';

export interface SupabaseConfig {
    url: string;
    key: string;
}

export interface OrderQueueItem {
    id?: bigint;
    batch_id: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    order_data: ApiOrderRequest;
    scheduled_time: string;
    status: 'draft' | 'pending' | 'completed' | 'failed' | 'cancelled';
    created_at?: string;
    updated_at?: string;
    error_message?: string;
    total_amount: number;
    order_index: number;
}

export interface BatchStats {
    totalOrders: number;
    draftOrders: number;
    completedOrders: number;
    pendingOrders: number;
    failedOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    completedRevenue: number;
}

export interface DashboardStatsFilter {
    batchId?: string;
    startDate?: Date;
    endDate?: Date;
    statuses?: string[];
}

// TODO: Enable Row-Level Security (RLS) on Supabase tables (order_batches, orders_queue, app_settings, audit_logs).
// Currently all operations use anon key without server-side authorization.
// Add RLS policies to restrict access based on authenticated user role.
export class SupabaseService {
    public client: SupabaseClient;

    constructor(config: SupabaseConfig) {
        this.client = createClient(config.url, config.key);
    }

    // Create a new batch
    async createBatch(
        startDate: Date,
        endDate: Date,
        totalOrders: number,
        products: Product[]
    ): Promise<{ id: string }> {
        const batchId = `batch_${Date.now()}`;

        // Format dates in local timezone to avoid UTC shift
        // (e.g. 09/02 VN time would become 08/02 with toISOString)
        const formatLocal = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const { error } = await this.client
            .from('order_batches')
            .insert({
                id: batchId,
                start_date: formatLocal(startDate),
                end_date: formatLocal(endDate),
                total_orders: totalOrders,
                status: 'pending',
                products_data: products, // Store products as JSONB
            });

        if (error) throw new Error(`Failed to create batch: ${error.message}`);

        return { id: batchId };
    }

    // Get batch information
    async getBatch(batchId: string): Promise<any> {
        const { data, error } = await this.client
            .from('order_batches')
            .select('*')
            .eq('id', batchId)
            .single();

        if (error) throw new Error(`Failed to get batch: ${error.message}`);
        return data;
    }

    // Get batch statistics
    async getBatchStats(batchId: string): Promise<BatchStats> {
        const { data, error } = await this.client
            .from('orders_queue')
            .select('status, total_amount')
            .eq('batch_id', batchId);

        if (error) throw new Error(`Failed to get batch stats: ${error.message}`);

        const stats: BatchStats = {
            totalOrders: data?.length || 0,
            draftOrders: 0,
            completedOrders: 0,
            pendingOrders: 0,
            failedOrders: 0,
            cancelledOrders: 0,
            totalRevenue: 0,
            completedRevenue: 0,
        };

        data?.forEach((order: any) => {
            stats.totalRevenue += order.total_amount || 0;

            switch (order.status) {
                case 'draft':
                    stats.draftOrders++;
                    break;
                case 'completed':
                    stats.completedOrders++;
                    stats.completedRevenue += order.total_amount || 0;
                    break;
                case 'pending':
                    stats.pendingOrders++;
                    break;
                case 'failed':
                    stats.failedOrders++;
                    break;
                case 'cancelled':
                    stats.cancelledOrders++;
                    break;
            }
        });

        return stats;
    }

    // Get orders with pagination and filters
    async getOrders(
        batchId: string,
        options: {
            page?: number;
            pageSize?: number;
            status?: string;
            statuses?: string[];
            searchText?: string;
            dateFrom?: Date;
            dateTo?: Date;
            orderBy?: string;
            ascending?: boolean;
        } = {}
    ): Promise<{
        data: any[];
        page: number;
        pageSize: number;
        totalPages: number;
        count: number;
    }> {
        const page = options.page || 1;
        const pageSize = options.pageSize || 10;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = this.client
            .from('orders_queue')
            .select('*', { count: 'exact' })
            .eq('batch_id', batchId);

        if (options.statuses && options.statuses.length > 0) {
            query = query.in('status', options.statuses);
        } else if (options.status) {
            query = query.eq('status', options.status);
        }

        if (options.searchText) {
            const search = `%${options.searchText}%`;
            query = query.or(`customer_name.ilike.${search},customer_phone.ilike.${search}`);
        }

        if (options.dateFrom) {
            query = query.gte('scheduled_time', options.dateFrom.toISOString());
        }

        if (options.dateTo) {
            const endOfDay = new Date(options.dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.lte('scheduled_time', endOfDay.toISOString());
        }

        if (options.orderBy) {
            query = query.order(options.orderBy, { ascending: options.ascending !== false });
        } else {
            query = query.order('scheduled_time', { ascending: true });
        }

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw new Error(`Failed to get orders: ${error.message}`);

        return {
            data: data || [],
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
            count: count || 0,
        };
    }

    // Get ALL orders for a batch (for export)
    async getAllOrders(batchId: string, filters?: {
        statuses?: string[];
        searchText?: string;
        dateFrom?: Date;
        dateTo?: Date;
    }): Promise<any[]> {
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;
        const allData: any[] = [];

        while (hasMore) {
            let query = this.client
                .from('orders_queue')
                .select('*')
                .eq('batch_id', batchId)
                .order('scheduled_time', { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (filters?.statuses && filters.statuses.length > 0) {
                query = query.in('status', filters.statuses);
            }
            if (filters?.searchText) {
                const search = `%${filters.searchText}%`;
                query = query.or(`customer_name.ilike.${search},customer_phone.ilike.${search}`);
            }
            if (filters?.dateFrom) {
                query = query.gte('scheduled_time', filters.dateFrom.toISOString());
            }
            if (filters?.dateTo) {
                const endOfDay = new Date(filters.dateTo);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.lte('scheduled_time', endOfDay.toISOString());
            }

            const { data, error } = await query;
            if (error) throw new Error(`Failed to get all orders: ${error.message}`);
            if (!data || data.length === 0) { hasMore = false; break; }
            allData.push(...data);
            hasMore = data.length >= pageSize;
            offset += pageSize;
        }

        return allData;
    }

    // Save orders to queue
    async saveOrdersToQueue(
        batchId: string,
        orders: Array<{
            orderIndex?: number;
            customerId: number;
            customerName: string;
            customerPhone: string;
            orderData: ApiOrderRequest;
            scheduledTime: Date;
            totalAmount: number;
        }>
    ): Promise<void> {
        // Lấy max order_index hiện tại nếu chưa có orderIndex trong orders
        let startIndex = 0;
        if (orders.length > 0 && orders[0].orderIndex === undefined) {
            const { data: maxIndexData } = await this.client
                .from('orders_queue')
                .select('order_index')
                .eq('batch_id', batchId)
                .order('order_index', { ascending: false })
                .limit(1)
                .single();

            if (maxIndexData) {
                startIndex = maxIndexData.order_index + 1;
            }
        }

        const orderRecords: Omit<OrderQueueItem, 'id'>[] = orders.map((order, index) => ({
            batch_id: batchId,
            customer_id: order.customerId,
            customer_name: order.customerName,
            customer_phone: order.customerPhone,
            order_data: order.orderData,
            scheduled_time: order.scheduledTime.toISOString(),
            status: 'draft' as const,
            total_amount: order.totalAmount,
            order_index: order.orderIndex !== undefined ? order.orderIndex : startIndex + index,
        }));

        const { error } = await this.client
            .from('orders_queue')
            .insert(orderRecords);

        if (error) throw new Error(`Failed to save orders: ${error.message}`);
    }

    // Cancel pending/draft orders from a specific date
    async cancelPendingOrdersFromDate(batchId: string, fromDate: Date): Promise<any[]> {
        const { data, error } = await this.client
            .from('orders_queue')
            .update({ status: 'cancelled' })
            .eq('batch_id', batchId)
            .in('status', ['pending', 'draft'])
            .gte('scheduled_time', fromDate.toISOString())
            .select();

        if (error) throw new Error(`Failed to cancel orders: ${error.message}`);
        return data || [];
    }

    // ==================== Draft Approval Methods ====================

    // Approve all draft orders in a batch (draft → pending)
    async approveAllDraftOrders(batchId: string): Promise<number> {
        const { data, error } = await this.client
            .from('orders_queue')
            .update({ status: 'pending' })
            .eq('batch_id', batchId)
            .eq('status', 'draft')
            .select('id');

        if (error) throw new Error(`Failed to approve orders: ${error.message}`);
        return data?.length || 0;
    }

    // Approve selected draft orders (draft → pending)
    async approveSelectedOrders(orderIds: number[]): Promise<number> {
        const { data, error } = await this.client
            .from('orders_queue')
            .update({ status: 'pending' })
            .in('id', orderIds)
            .eq('status', 'draft')
            .select('id');

        if (error) throw new Error(`Failed to approve selected orders: ${error.message}`);
        return data?.length || 0;
    }

    // ==================== Individual Order Actions ====================

    // Get a single order by ID
    async getOrderById(orderId: number): Promise<OrderQueueItem | null> {
        const { data, error } = await this.client
            .from('orders_queue')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to get order: ${error.message}`);
        }
        return data;
    }

    // Cancel a single order (draft/pending → cancelled)
    async cancelOrder(orderId: number): Promise<void> {
        const { error } = await this.client
            .from('orders_queue')
            .update({ status: 'cancelled' })
            .eq('id', orderId)
            .in('status', ['draft', 'pending']);

        if (error) throw new Error(`Failed to cancel order: ${error.message}`);
    }

    // Retry a failed order (failed → pending)
    async retryFailedOrder(orderId: number): Promise<void> {
        const { error } = await this.client
            .from('orders_queue')
            .update({ status: 'pending', error_message: null })
            .eq('id', orderId)
            .eq('status', 'failed');

        if (error) throw new Error(`Failed to retry order: ${error.message}`);
    }

    // Update an order (only draft/pending)
    async updateOrder(orderId: number, updates: {
        customer_name?: string;
        customer_phone?: string;
        customer_id?: number;
        order_data?: ApiOrderRequest;
        scheduled_time?: string;
        total_amount?: number;
    }): Promise<void> {
        const { error } = await this.client
            .from('orders_queue')
            .update(updates)
            .eq('id', orderId)
            .in('status', ['draft', 'pending']);

        if (error) throw new Error(`Failed to update order: ${error.message}`);
    }

    // Delete a single order (only draft/cancelled)
    async deleteOrder(orderId: number): Promise<void> {
        const { error } = await this.client
            .from('orders_queue')
            .delete()
            .eq('id', orderId)
            .in('status', ['draft', 'cancelled']);

        if (error) throw new Error(`Failed to delete order: ${error.message}`);
    }

    // Delete multiple orders (only draft/cancelled)
    async deleteOrders(orderIds: number[]): Promise<number> {
        const { data, error } = await this.client
            .from('orders_queue')
            .delete()
            .in('id', orderIds)
            .in('status', ['draft', 'cancelled'])
            .select('id');

        if (error) throw new Error(`Failed to delete orders: ${error.message}`);
        return data?.length || 0;
    }

    // Delete a batch and all its orders (hard delete)
    async deleteBatch(batchId: string): Promise<{ deletedOrders: number }> {
        // Delete child orders first, then parent batch
        const { data, error: ordersError } = await this.client
            .from('orders_queue')
            .delete()
            .eq('batch_id', batchId)
            .select('id');

        if (ordersError) throw new Error(`Failed to delete orders: ${ordersError.message}`);

        const { error: batchError } = await this.client
            .from('order_batches')
            .delete()
            .eq('id', batchId);

        if (batchError) throw new Error(`Failed to delete batch: ${batchError.message}`);

        return { deletedOrders: data?.length || 0 };
    }

    // ==================== Audit Log Methods ====================

    async logAudit(params: {
        userEmail: string;
        action: string;
        entityType?: string;
        entityId?: string;
        details?: any;
    }): Promise<void> {
        const { error } = await this.client
            .from('audit_logs')
            .insert({
                user_email: params.userEmail,
                action: params.action,
                entity_type: params.entityType || null,
                entity_id: params.entityId || null,
                details: params.details || null,
            });

        if (error) {
            console.warn('Failed to log audit:', error.message);
        }
    }

    async getAuditLogs(filters: {
        userEmail?: string;
        action?: string;
        entityType?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        pageSize?: number;
    } = {}): Promise<{ data: any[]; count: number }> {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = this.client
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (filters.userEmail) query = query.eq('user_email', filters.userEmail);
        if (filters.action) query = query.eq('action', filters.action);
        if (filters.entityType) query = query.eq('entity_type', filters.entityType);
        if (filters.startDate) query = query.gte('created_at', filters.startDate.toISOString());
        if (filters.endDate) query = query.lte('created_at', filters.endDate.toISOString());

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.warn('Failed to get audit logs:', error.message);
            return { data: [], count: 0 };
        }

        return { data: data || [], count: count || 0 };
    }

    // Get products from batch
    async getBatchProducts(batchId: string): Promise<Product[]> {
        const { data, error } = await this.client
            .from('order_batches')
            .select('products_data')
            .eq('id', batchId)
            .single();

        if (error) throw new Error(`Failed to get batch products: ${error.message}`);
        return (data?.products_data as Product[]) || [];
    }

    // Get products from orders (fallback)
    async getProductsFromOrders(batchId: string): Promise<Product[]> {
        const { data, error } = await this.client
            .from('orders_queue')
            .select('order_data')
            .eq('batch_id', batchId)
            .limit(1);

        if (error) throw new Error(`Failed to get products from orders: ${error.message}`);

        if (!data || data.length === 0) return [];

        const orderData = data[0].order_data as any;
        return (orderData.products || []).map((p: any) => ({
            id: p.id,
            name: p.name || '',
            code: p.code || '',
            price: p.price,
            quantity: p.quantity,
        }));
    }

    // Update batch products
    async updateBatchProducts(batchId: string, products: Product[]): Promise<void> {
        const { error } = await this.client
            .from('order_batches')
            .update({ products_data: products })
            .eq('id', batchId);

        if (error) throw new Error(`Failed to update batch products: ${error.message}`);
    }

    async updateBatchTotalOrders(batchId: string, totalOrders: number): Promise<void> {
        const { error } = await this.client
            .from('order_batches')
            .update({ total_orders: totalOrders })
            .eq('id', batchId);

        if (error) throw new Error(`Failed to update batch total_orders: ${error.message}`);
    }

    // Get used product quantities
    // CÁCH TÍNH TOÁN CHI TIẾT:
    // 
    // 1. Bảng: orders_queue
    // 2. Cột sử dụng:
    //    - batch_id: để filter theo batch
    //    - bill_id: chỉ lấy các đơn đã có bill_id (đã tạo thành công trên NhanhVN)
    //    - order_data: JSONB chứa thông tin đơn hàng, trong đó có mảng products
    //
    // 3. Query SQL tương đương (với pagination để tránh giới hạn 1000 rows):
    //    SELECT order_data, bill_id
    //    FROM orders_queue
    //    WHERE batch_id = 'batch_xxx'
    //      AND bill_id IS NOT NULL
    //    LIMIT 1000 OFFSET 0; -- Lặp lại với OFFSET tăng dần
    //
    // 4. Parse order_data (JSONB):
    //    order_data = {
    //      "depotId": 215639,
    //      "customer": { "id": 123 },
    //      "products": [
    //        { "id": 1231279582, "quantity": 2 },
    //        { "id": 1231279583, "quantity": 1 }
    //      ],
    //      "payment": { "customerAmount": 500000 }
    //    }
    //
    // 5. Tính toán:
    //    - Duyệt qua tất cả đơn hàng có bill_id (dùng pagination để lấy hết)
    //    - Với mỗi đơn, lấy order_data.products
    //    - Cộng dồn quantity theo product_id
    //    - Ví dụ: SP ID 123 có trong 2 đơn (2 cái + 1 cái) = 3 cái tổng cộng
    async getUsedProductQuantities(batchId: string): Promise<Map<number, number>> {
        const quantities = new Map<number, number>();
        const pageSize = 1000; // Supabase mặc định limit 1000
        let offset = 0;
        let hasMore = true;

        // Dùng pagination để lấy TẤT CẢ đơn hàng (tránh giới hạn 1000 rows)
        while (hasMore) {
            const { data, error } = await this.client
                .from('orders_queue')
                .select('order_data, bill_id')
                .eq('batch_id', batchId)
                .not('bill_id', 'is', null) // Chỉ lấy các đơn đã có bill_id (đã tạo thành công)
                .range(offset, offset + pageSize - 1); // Pagination

            if (error) throw new Error(`Failed to get used quantities: ${error.message}`);

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            // Duyệt qua từng đơn hàng đã hoàn thành trong batch này
            data.forEach((order: any) => {
                // Chỉ tính các đơn đã có bill_id (đã tạo thành công trên NhanhVN)
                if (order.bill_id && order.order_data) {
                    // Parse JSONB order_data để lấy mảng products
                    const products = order.order_data.products || [];
                    
                    // Cộng dồn số lượng theo product_id
                    products.forEach((p: any) => {
                        if (p.id && p.quantity) {
                            const currentTotal = quantities.get(p.id) || 0;
                            quantities.set(p.id, currentTotal + p.quantity);
                        }
                    });
                }
            });

            // Nếu số lượng trả về < pageSize, nghĩa là đã hết dữ liệu
            if (data.length < pageSize) {
                hasMore = false;
            } else {
                offset += pageSize;
            }
        }

        return quantities;
    }

    // Get failed product quantities
    async getFailedProductQuantities(batchId: string): Promise<Map<number, number>> {
        const { data, error } = await this.client
            .from('orders_queue')
            .select('order_data, status')
            .eq('batch_id', batchId)
            .eq('status', 'failed');

        if (error) throw new Error(`Failed to get failed quantities: ${error.message}`);

        const quantities = new Map<number, number>();
        data?.forEach((order: any) => {
            const products = order.order_data?.products || [];
            products.forEach((p: any) => {
                quantities.set(p.id, (quantities.get(p.id) || 0) + p.quantity);
            });
        });

        return quantities;
    }

    // Get pending product quantities from a specific date
    async getPendingProductQuantities(batchId: string, fromDate: Date): Promise<Map<number, number>> {
        const { data, error } = await this.client
            .from('orders_queue')
            .select('order_data, status')
            .eq('batch_id', batchId)
            .eq('status', 'pending')
            .gte('scheduled_time', fromDate.toISOString());

        if (error) throw new Error(`Failed to get pending quantities: ${error.message}`);

        const quantities = new Map<number, number>();
        data?.forEach((order: any) => {
            const products = order.order_data?.products || [];
            products.forEach((p: any) => {
                quantities.set(p.id, (quantities.get(p.id) || 0) + p.quantity);
            });
        });

        return quantities;
    }

    // Get cancelled product quantities
    async getCancelledProductQuantities(batchId: string): Promise<Map<number, number>> {
        const { data, error } = await this.client
            .from('orders_queue')
            .select('order_data, status')
            .eq('batch_id', batchId)
            .eq('status', 'cancelled');

        if (error) throw new Error(`Failed to get cancelled quantities: ${error.message}`);

        const quantities = new Map<number, number>();
        data?.forEach((order: any) => {
            const products = order.order_data?.products || [];
            products.forEach((p: any) => {
                quantities.set(p.id, (quantities.get(p.id) || 0) + p.quantity);
            });
        });

        return quantities;
    }

    // Get dashboard statistics with filters
    // Tối ưu: Sử dụng RPC function để aggregate trên server (nhanh hơn, không bị limit 1000)
    // Fallback: Nếu RPC function không tồn tại, dùng pagination để lấy tất cả data
    async getDashboardStats(filter: DashboardStatsFilter = {}): Promise<any> {
        // Thử sử dụng RPC function trước (nhanh hơn, aggregate trên server)
        try {
            const rpcParams: any = {
                p_batch_id: filter.batchId || null,
                p_start_date: filter.startDate ? filter.startDate.toISOString() : null,
                p_end_date: filter.endDate ? (() => {
                    const endOfDay = new Date(filter.endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    return endOfDay.toISOString();
                })() : null,
                p_statuses: filter.statuses && filter.statuses.length > 0 ? filter.statuses : null,
            };

            const { data: rpcData, error: rpcError } = await this.client.rpc('get_dashboard_stats_aggregated', rpcParams);

            if (!rpcError && rpcData) {
                // RPC function thành công, parse JSONB result
                const result = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
                
                // Convert hour format từ "0:00" về số 0 cho histogramCount và histogramAmount
                const convertHourFormat = (items: any[]) => {
                    return items.map((item: any) => {
                        if (item.hour && typeof item.hour === 'string' && item.hour.includes(':')) {
                            const hourNum = parseInt(item.hour.split(':')[0]);
                            return { ...item, hour: hourNum };
                        }
                        return item;
                    });
                };

                // Convert date format từ "DD/MM/YYYY" về "YYYY-MM-DD" cho revenueByDate
                const convertDateFormat = (items: any[]) => {
                    return items.map((item: any) => {
                        if (item.date && item.date.includes('/')) {
                            // Convert từ DD/MM/YYYY sang YYYY-MM-DD
                            const [day, month, year] = item.date.split('/');
                            return { ...item, date: `${year}-${month}-${day}` };
                        }
                        return item;
                    });
                };

                // Lấy productQuantityByDate từ function riêng nếu có
                let productQuantityByDate: any[] = [];
                try {
                    const { data: productQtyData, error: productQtyError } = await this.client.rpc('get_product_quantity_by_date', rpcParams);
                    if (!productQtyError && productQtyData) {
                        productQuantityByDate = Array.isArray(productQtyData) ? productQtyData : [];
                    }
                } catch (e) {
                    // Function không tồn tại, sẽ tính từ data fallback
                    console.warn('Function get_product_quantity_by_date không khả dụng:', e);
                }

                return {
                    statusBreakdown: result.statusBreakdown || [],
                    histogramCount: convertHourFormat(result.histogramCount || []),
                    histogramAmount: convertHourFormat(result.histogramAmount || []),
                    revenueByDate: convertDateFormat(result.revenueByDate || []),
                    revenueByHour: convertHourFormat(result.revenueByHour || []),
                    productQuantityByDate: productQuantityByDate.length > 0 ? productQuantityByDate : [],
                };
            }
        } catch (rpcErr) {
            // RPC function không tồn tại hoặc có lỗi, fallback về cách cũ
            console.warn('RPC function get_dashboard_stats_aggregated không khả dụng, sử dụng pagination:', rpcErr);
        }

        // Fallback: Sử dụng pagination để lấy TẤT CẢ dữ liệu (tránh giới hạn 1000 rows của Supabase)
        const pageSize = 1000; // Supabase mặc định limit 1000
        let offset = 0;
        let hasMore = true;
        const allData: any[] = [];

        // Dùng pagination để lấy TẤT CẢ đơn hàng (tránh giới hạn 1000 rows)
        while (hasMore) {
            let query = this.client
                .from('orders_queue')
                .select('*')
                .range(offset, offset + pageSize - 1); // Pagination

            if (filter.batchId) {
                query = query.eq('batch_id', filter.batchId);
            }

            if (filter.startDate) {
                query = query.gte('scheduled_time', filter.startDate.toISOString());
            }

            if (filter.endDate) {
                const endOfDay = new Date(filter.endDate);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.lte('scheduled_time', endOfDay.toISOString());
            }

            if (filter.statuses && filter.statuses.length > 0) {
                query = query.in('status', filter.statuses);
            }

            const { data, error } = await query;

            if (error) throw new Error(`Failed to get dashboard stats: ${error.message}`);

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            allData.push(...data);

            // Nếu số lượng trả về < pageSize, nghĩa là đã hết dữ liệu
            if (data.length < pageSize) {
                hasMore = false;
            } else {
                offset += pageSize;
            }
        }

        // Process the data to create dashboard statistics
        const statusBreakdown = calculateStatusBreakdown(allData);
        const histogramCount = calculateHistogramCount(allData);
        const histogramAmount = calculateHistogramAmount(allData);
        const revenueByDate = calculateRevenueByDate(allData);
        const revenueByHour = calculateRevenueByHour(allData);
        const productQuantityByDate = calculateProductQuantityByDate(allData);

        return {
            statusBreakdown,
            histogramCount,
            histogramAmount,
            revenueByDate,
            revenueByHour,
            productQuantityByDate,
        };
    }

    // ==================== Customer List Methods ====================

    /** Get or create the single default customer list */
    async getOrCreateDefaultCustomerList(createdBy?: string): Promise<CustomerList> {
        // Try to get existing list
        const { data, error } = await this.client
            .from('customer_lists')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (data) return data as CustomerList;

        // No list exists, create one
        if (error && error.code === 'PGRST116') {
            const { data: newList, error: createError } = await this.client
                .from('customer_lists')
                .insert({ name: 'Danh sách khách hàng', created_by: createdBy || null })
                .select()
                .single();

            // If insert failed (e.g. race condition from another tab), try fetching again
            if (createError) {
                const { data: retryData } = await this.client
                    .from('customer_lists')
                    .select('*')
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .single();
                if (retryData) return retryData as CustomerList;
                throw new Error(`Failed to create customer list: ${createError.message}`);
            }
            return newList as CustomerList;
        }

        throw new Error(`Failed to get customer list: ${error?.message}`);
    }

    /** Get all customer items from the default list.
     *  When totalCount is provided, fires all page queries in parallel for speed. */
    async getCustomerItems(listId: string, totalCount?: number): Promise<CustomerListItem[]> {
        const pageSize = 1000;

        // Parallel loading when we know the total count upfront
        if (totalCount && totalCount > pageSize) {
            const totalPages = Math.ceil(totalCount / pageSize);
            const promises = Array.from({ length: totalPages }, (_, i) => {
                const offset = i * pageSize;
                return this.client
                    .from('customer_list_items')
                    .select('*')
                    .eq('list_id', listId)
                    .order('id', { ascending: true })
                    .range(offset, offset + pageSize - 1);
            });

            const results = await Promise.all(promises);
            const allItems: CustomerListItem[] = [];
            for (const result of results) {
                if (result.error) throw new Error(`Failed to get customers: ${result.error.message}`);
                if (result.data) allItems.push(...(result.data as CustomerListItem[]));
            }
            return allItems;
        }

        // Sequential fallback for small datasets or unknown count
        const allItems: CustomerListItem[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await this.client
                .from('customer_list_items')
                .select('*')
                .eq('list_id', listId)
                .order('id', { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (error) throw new Error(`Failed to get customers: ${error.message}`);
            if (!data || data.length === 0) { hasMore = false; break; }

            allItems.push(...(data as CustomerListItem[]));
            hasMore = data.length >= pageSize;
            offset += pageSize;
        }

        return allItems;
    }

    /** Get a page of customer items with optional search. Returns items + total count. */
    async getCustomerItemsPage(
        listId: string,
        page: number,
        pageSize: number,
        search?: string,
    ): Promise<{ items: CustomerListItem[]; totalCount: number }> {
        let query = this.client
            .from('customer_list_items')
            .select('*', { count: 'exact' })
            .eq('list_id', listId);

        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,customer_ext_id.ilike.%${search}%`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error, count } = await query
            .order('id', { ascending: true })
            .range(from, to);

        if (error) throw new Error(`Failed to get customers: ${error.message}`);

        return {
            items: (data || []) as CustomerListItem[],
            totalCount: count || 0,
        };
    }

    /** Bulk upsert customer items (for Excel import). Updates existing by customer_ext_id. Batches to avoid timeout. */
    async upsertCustomerItems(
        listId: string,
        items: CustomerListItemInsert[],
        onProgress?: (processed: number, total: number) => void,
    ): Promise<{ inserted: number; updated: number }> {
        const records = items.map((item) => ({
            list_id: listId,
            customer_ext_id: item.customer_ext_id,
            name: item.name,
            phone: item.phone,
        }));

        // Batch upsert in chunks of 100 to stay within Supabase statement timeout
        const batchSize = 100;
        let totalInserted = 0;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const { error, count } = await this.client
                .from('customer_list_items')
                .upsert(batch, { onConflict: 'list_id,customer_ext_id', count: 'exact' });

            if (error) throw new Error(`Lỗi import batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
            totalInserted += count || batch.length;
            onProgress?.(Math.min(i + batchSize, records.length), records.length);
        }

        return { inserted: totalInserted, updated: 0 };
    }

    /** Add a single customer item */
    async addCustomerItem(listId: string, item: CustomerListItemInsert): Promise<CustomerListItem> {
        const { data, error } = await this.client
            .from('customer_list_items')
            .insert({ list_id: listId, ...item })
            .select()
            .single();

        if (error) throw new Error(`Failed to add customer: ${error.message}`);
        return data as CustomerListItem;
    }

    /** Update a single customer item */
    async updateCustomerItem(itemId: number, updates: Partial<CustomerListItemInsert>): Promise<void> {
        const { error } = await this.client
            .from('customer_list_items')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', itemId);

        if (error) throw new Error(`Failed to update customer: ${error.message}`);
    }

    /** Delete a single customer item */
    async deleteCustomerItem(itemId: number): Promise<void> {
        const { error } = await this.client
            .from('customer_list_items')
            .delete()
            .eq('id', itemId);

        if (error) throw new Error(`Failed to delete customer: ${error.message}`);
    }

    /** Delete multiple customer items */
    async deleteCustomerItems(itemIds: number[]): Promise<number> {
        const { data, error } = await this.client
            .from('customer_list_items')
            .delete()
            .in('id', itemIds)
            .select('id');

        if (error) throw new Error(`Failed to delete customers: ${error.message}`);
        return data?.length || 0;
    }

    // ==================== Settings Methods ====================

    async getSettings(): Promise<Record<string, any>> {
        const { data, error } = await this.client
            .from('app_settings')
            .select('key, value');

        if (error) {
            console.error('Failed to load settings:', error.message);
            return {};
        }

        const settings: Record<string, any> = {};
        for (const row of data || []) {
            settings[row.key] = row.value;
        }
        return settings;
    }

    async updateSetting(key: string, value: any, updatedBy?: string): Promise<void> {
        const { error } = await this.client
            .from('app_settings')
            .upsert({
                key,
                value,
                updated_by: updatedBy || null,
            }, { onConflict: 'key' });

        if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);
    }

    // ==================== Batch List Methods ====================

    async getRecentBatches(limit: number = 20): Promise<Array<{
        id: string;
        start_date: string;
        end_date: string;
        total_orders: number;
        status: string;
        created_at: string;
    }>> {
        const { data, error } = await this.client
            .from('order_batches')
            .select('id, start_date, end_date, total_orders, status, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Failed to fetch recent batches:', error.message);
            return [];
        }

        return data || [];
    }

    async getRecentBatchesWithStatus(params: {
        limit?: number;
        offset?: number;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        batches: Array<{
            id: string;
            start_date: string;
            end_date: string;
            total_orders: number;
            status: string;
            created_at: string;
            computed_status: string;
            completed_count: number;
            failed_count: number;
            pending_count: number;
        }>;
        totalCount: number;
    }> {
        const { limit = 20, offset = 0, startDate, endDate } = params;

        const [batchResult, countResult] = await Promise.all([
            this.client.rpc('get_recent_batches_with_status', {
                p_limit: limit,
                p_offset: offset,
                p_start_date: startDate || null,
                p_end_date: endDate || null,
            }),
            this.client.rpc('get_batches_count', {
                p_start_date: startDate || null,
                p_end_date: endDate || null,
            }),
        ]);

        if (batchResult.error) {
            console.error('Failed to fetch batches with status:', batchResult.error.message);
            return { batches: [], totalCount: 0 };
        }

        return {
            batches: batchResult.data || [],
            totalCount: countResult.error ? 0 : (countResult.data || 0),
        };
    }
}

// Singleton instance - avoids creating multiple Supabase clients
let _instance: SupabaseService | null = null;

export function getSupabaseService(): SupabaseService | null {
    if (_instance) return _instance;

    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    _instance = new SupabaseService({ url, key });
    return _instance;
}
