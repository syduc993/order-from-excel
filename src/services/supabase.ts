import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product } from '@/types/excel';
import { ApiOrderRequest } from '@/types/api';
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
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    created_at?: string;
    updated_at?: string;
    error_message?: string;
    total_amount: number;
    order_index: number;
}

export interface BatchStats {
    totalOrders: number;
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

        const { error } = await this.client
            .from('order_batches')
            .insert({
                id: batchId,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
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

        if (options.status) {
            query = query.eq('status', options.status);
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
            status: 'pending' as const,
            total_amount: order.totalAmount,
            order_index: order.orderIndex !== undefined ? order.orderIndex : startIndex + index,
        }));

        const { error } = await this.client
            .from('orders_queue')
            .insert(orderRecords);

        if (error) throw new Error(`Failed to save orders: ${error.message}`);
    }

    // Cancel pending orders from a specific date
    async cancelPendingOrdersFromDate(batchId: string, fromDate: Date): Promise<any[]> {
        const { data, error } = await this.client
            .from('orders_queue')
            .update({ status: 'cancelled' })
            .eq('batch_id', batchId)
            .eq('status', 'pending')
            .gte('scheduled_time', fromDate.toISOString())
            .select();

        if (error) throw new Error(`Failed to cancel orders: ${error.message}`);
        return data || [];
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
}
