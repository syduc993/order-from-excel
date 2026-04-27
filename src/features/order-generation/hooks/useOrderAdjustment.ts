import { useState } from 'react';
import { toast } from 'sonner';
import { SupabaseService } from '@/services/supabase';
import { Customer, Product } from '@/types/excel';
import { ApiOrderRequest, ApiProduct } from '@/types/api';
import { calculateTotalOrders } from '@/utils/orderUtils';
import { calculateOrdersPerDay, distributeOrdersToDays } from '@/utils/timeDistribution';
import { generateRandomOrder } from '@/utils/orderGenerator';
import { env } from '@/config/env';
import { adjustProductsToInventory } from '@/utils/inventoryValidator';
import { NhanhApiClient } from '@/services/nhanhApi';
import { validateInventory, getInventoryMap } from '@/utils/inventoryValidator';
import { InventoryValidationResult } from '@/types/inventoryTypes';
import { useSettings } from '@/contexts/SettingsContext';

interface UseOrderAdjustmentProps {
    customers: Customer[];
    products: Product[];
    inventoryMap: Map<number, number>;
    useActualInventory: boolean;
    nhanhClient: NhanhApiClient | null;
    onInventoryCheck?: (result: InventoryValidationResult, inventoryMap: Map<number, number>) => void;
    onSuccess: (batchId: string) => void;
}

export const useOrderAdjustment = ({
    customers,
    products,
    inventoryMap,
    useActualInventory,
    nhanhClient,
    onInventoryCheck,
    onSuccess,
}: UseOrderAdjustmentProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { settings } = useSettings();

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

    const adjustOrdersFromDate = async (
        batchId: string,
        adjustFromDate: Date,
        adjustEndDate?: Date | null,
        skipInventoryCheck: boolean = false,
        confirmedInventoryMap?: Map<number, number>,
        confirmedUseActual: boolean = false
    ) => {
        if (!supabaseConfig) {
            toast.error('Vui lòng cấu hình Supabase trong file .env');
            return;
        }

        const supabaseService = new SupabaseService(supabaseConfig);

        try {
            setIsProcessing(true);

            // Lấy customers và products từ database nếu chưa có trong state
            let customersToUse = customers;
            let productsToUse = products;

            if (customersToUse.length === 0 || productsToUse.length === 0) {
                toast.info('Đang lấy thông tin khách hàng và sản phẩm từ database...');

                // Lấy customers từ orders_queue
                const { data: ordersForCustomers } = await supabaseService.client
                    .from('orders_queue')
                    .select('customer_id, customer_name, customer_phone')
                    .eq('batch_id', batchId)
                    .limit(1000);

                const customerMap = new Map<string | number, Customer>();
                for (const order of ordersForCustomers || []) {
                    if (order.customer_id && order.customer_name && order.customer_phone) {
                        const customerId = String(order.customer_id);
                        if (!customerMap.has(customerId)) {
                            customerMap.set(customerId, {
                                id: customerId,
                                name: order.customer_name,
                                phone: order.customer_phone,
                            });
                        }
                    }
                }
                customersToUse = Array.from(customerMap.values());

                // Lấy products từ batch (đã lưu khi tạo batch)
                productsToUse = await supabaseService.getBatchProducts(batchId);

                // Nếu không có trong batch, thử lấy từ orders (fallback)
                if (productsToUse.length === 0) {
                    toast.warning('Không tìm thấy sản phẩm trong batch, đang lấy từ đơn hàng...');
                    productsToUse = await supabaseService.getProductsFromOrders(batchId);
                }

                if (customersToUse.length === 0 || productsToUse.length === 0) {
                    toast.error('Không tìm thấy thông tin khách hàng hoặc sản phẩm trong batch. Vui lòng tải file Excel.');
                    return;
                }

                toast.success(`Đã lấy ${customersToUse.length} khách hàng và ${productsToUse.length} sản phẩm từ database`);
            }

            // 1. Lấy thông tin batch để biết endDate ban đầu
            const batch = await supabaseService.getBatch(batchId);
            const originalEndDate = new Date(batch.end_date);

            // Sử dụng adjustEndDate nếu có, nếu không thì dùng originalEndDate
            const finalEndDate = adjustEndDate || originalEndDate;

            // Đảm bảo adjustFromDate <= finalEndDate
            if (adjustFromDate > finalEndDate) {
                toast.error('Ngày điều chỉnh không được lớn hơn ngày kết thúc');
                return;
            }

            // 2. Hủy tất cả đơn pending từ ngày điều chỉnh trở đi
            toast.info(`Đang hủy các đơn hàng từ ${adjustFromDate.toLocaleDateString('vi-VN')} trở đi...`);
            const cancelledOrders = await supabaseService.cancelPendingOrdersFromDate(batchId, adjustFromDate);
            toast.success(`Đã hủy ${cancelledOrders.length} đơn hàng pending`);

            // 3. Tính khoảng ngày còn lại
            const remainingStartDate = new Date(adjustFromDate);
            remainingStartDate.setHours(0, 0, 0, 0);
            const remainingEndDate = new Date(finalEndDate);
            remainingEndDate.setHours(23, 59, 59, 999);

            // 4. Cập nhật end_date của batch nếu người dùng chọn ngày kết thúc mới
            if (adjustEndDate && adjustEndDate.getTime() !== originalEndDate.getTime()) {
                toast.info(`Đang cập nhật ngày kết thúc batch từ ${originalEndDate.toLocaleDateString('vi-VN')} sang ${adjustEndDate.toLocaleDateString('vi-VN')}...`);
                await supabaseService.client
                    .from('order_batches')
                    .update({ end_date: adjustEndDate.toISOString().split('T')[0] })
                    .eq('id', batchId);
                toast.success('Đã cập nhật ngày kết thúc batch');
            }

            // 4. Tính toán tồn kho còn lại và số lượng đơn mới
            toast.info('Đang tính toán số lượng sản phẩm còn lại...');
            const usedQuantities = await supabaseService.getUsedProductQuantities(batchId);
            // const failedQuantities = await supabaseService.getFailedProductQuantities(batchId); // Unused
            // const pendingQuantities = await supabaseService.getPendingProductQuantities(batchId, adjustFromDate); // Unused
            // const cancelledQuantities = await supabaseService.getCancelledProductQuantities(batchId); // Unused

            // Create inventory for adjustment based on INITIAL products minus USED
            // Track products where used > initial (over-used)
            let totalOverUsed = 0;
            const overUsedProducts: Array<{ id: number; name: string; initial: number; used: number; diff: number }> = [];

            const currentInventory = productsToUse.map(p => {
                const used = usedQuantities.get(p.id) || 0;
                const remaining = p.quantity - used;

                // Phát hiện sản phẩm đã dùng vượt quá số lượng ban đầu
                if (remaining < 0) {
                    const overUsedQty = Math.abs(remaining);
                    totalOverUsed += overUsedQty;
                    overUsedProducts.push({
                        id: p.id,
                        name: p.name || `SP#${p.id}`,
                        initial: p.quantity,
                        used: used,
                        diff: overUsedQty
                    });
                }

                return {
                    ...p,
                    quantity: Math.max(0, remaining)
                };
            });

            // Kiểm tra tồn kho NhanhVN với số lượng còn lại
            let finalInventory = currentInventory;

            if (!skipInventoryCheck && nhanhClient && currentInventory.length > 0) {
                toast.info('Đang kiểm tra tồn kho NhanhVN với số lượng còn lại...');
                try {
                    // Tạo map để lưu thông tin ban đầu và đã dùng
                    const initialQuantityMap = new Map<number, number>();
                    const usedQuantityMap = new Map<number, number>();
                    productsToUse.forEach(p => {
                        initialQuantityMap.set(p.id, p.quantity);
                        usedQuantityMap.set(p.id, usedQuantities.get(p.id) || 0);
                    });

                    const inventoryCheckResult = await validateInventory(currentInventory, nhanhClient, settings.apiConfig.depotId);
                    
                    // Bổ sung thông tin ban đầu và đã dùng vào kết quả
                    inventoryCheckResult.checks = inventoryCheckResult.checks.map(check => ({
                        ...check,
                        initialQuantity: initialQuantityMap.get(check.productId),
                        usedQuantity: usedQuantityMap.get(check.productId),
                    }));

                    const adjustmentInventoryMap = await getInventoryMap(currentInventory, nhanhClient, settings.apiConfig.depotId);

                    // Gọi callback để hiển thị modal xác nhận
                    if (onInventoryCheck) {
                        onInventoryCheck(inventoryCheckResult, adjustmentInventoryMap);
                        // Dừng lại, đợi user xác nhận trong modal
                        // Hàm sẽ được gọi lại với skipInventoryCheck = true sau khi user xác nhận
                        return;
                    }

                    // Nếu không có callback, sử dụng useActualInventory từ props
                    if (useActualInventory && adjustmentInventoryMap.size > 0) {
                        finalInventory = adjustProductsToInventory(currentInventory, adjustmentInventoryMap);
                        toast.info('Sử dụng số lượng tồn kho thực tế từ NhanhVN');
                    }
                } catch (error) {
                    console.error('Error checking inventory:', error);
                    toast.warning('Không thể kiểm tra tồn kho NhanhVN, tiếp tục với số lượng tính toán');
                }
            } else if (skipInventoryCheck && confirmedInventoryMap && confirmedUseActual) {
                // Đã xác nhận từ modal, sử dụng inventoryMap đã xác nhận
                finalInventory = adjustProductsToInventory(currentInventory, confirmedInventoryMap);
                toast.info('Sử dụng số lượng tồn kho thực tế từ NhanhVN (đã xác nhận)');
            } else if (useActualInventory && inventoryMap.size > 0) {
                // Sử dụng inventoryMap từ props nếu có
                finalInventory = adjustProductsToInventory(currentInventory, inventoryMap);
                toast.info('Sử dụng số lượng tồn kho thực tế từ NhanhVN');
            }

            // Log cảnh báo nếu có sản phẩm bị over-used
            if (totalOverUsed > 0) {
                console.warn(`⚠️ [adjustOrdersFromDate] CẢNH BÁO: Có ${overUsedProducts.length} sản phẩm đã dùng VƯỢT QUÁ số lượng ban đầu trong file!`);
                console.warn(`📊 Tổng số lượng vượt quá: ${totalOverUsed.toLocaleString()} SP`);
                console.table(overUsedProducts.slice(0, 20)); // Hiển thị top 20 sản phẩm
                if (overUsedProducts.length > 20) {
                    console.warn(`... và ${overUsedProducts.length - 20} sản phẩm khác.`);
                }
            }

            // Tính số lượng đơn hàng tự động từ sản phẩm còn lại (đã điều chỉnh nếu cần)
            const totalOrders = calculateTotalOrders(
                finalInventory,
                settings.orderRules.minTotalAmount,
                settings.orderRules.maxTotalAmount,
                settings.orderRules.avgOrderValueRatio
            );

            if (totalOrders <= 0) {
                toast.warning('Không còn đủ sản phẩm để tạo thêm đơn hàng');
                return;
            }

            // 5. Tính số lượng đơn hàng cho mỗi ngày còn lại
            const ordersPerDay = calculateOrdersPerDay(
                totalOrders,
                remainingStartDate,
                remainingEndDate,
                settings.timeDistribution
            );

            console.log('Phân bổ đơn hàng điều chỉnh theo ngày:', ordersPerDay.map(d => ({
                date: d.date.toLocaleDateString('vi-VN'),
                count: d.orderCount
            })));

            // 6. Tạo đơn hàng mới
            const ordersWithoutTime: Array<{
                orderIndex: number;
                customerId: number;
                customerName: string;
                customerPhone: string;
                orderData: ApiOrderRequest;
                totalAmount: number;
                scheduledTime?: Date;
                isSweep?: boolean;
            }> = [];

            let orderIndex = 0;

            // Lấy max order_index hiện tại để tiếp tục
            const { data: maxIndexData } = await supabaseService.client
                .from('orders_queue')
                .select('order_index')
                .eq('batch_id', batchId)
                .order('order_index', { ascending: false })
                .limit(1)
                .single();

            if (maxIndexData) {
                orderIndex = maxIndexData.order_index + 1;
            }

            toast.info(`Đang tạo ${totalOrders} đơn hàng bổ sung...`);

            // Logic tạo đơn tương tự như handleSupabaseExport (có thể tách ra hàm chung sau này)
            // ... (Copy logic tạo đơn từ handleSupabaseExport)
            // Để tránh lặp code quá nhiều, mình sẽ copy logic tạo đơn vào đây nhưng rút gọn lại
            // Trong thực tế nên tách logic "generateOrdersFromInventory" ra utils

            // --- START GENERATION LOGIC ---
            // Sử dụng finalInventory (đã điều chỉnh theo tồn kho thực tế nếu cần)
            const workingInventory = finalInventory.map(p => ({ ...p }));
            let consecutiveFailCount = 0;
            const maxConsecutiveFails = settings.orderRules.maxConsecutiveFails;

            while (workingInventory.some(p => p.quantity > 0)) {
                const availableProducts = workingInventory.filter(p => p.quantity > 0);
                if (availableProducts.length === 0) break;

                const totalRemainingValue = availableProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0);
                if (totalRemainingValue < settings.orderRules.minTotalAmount) break;

                const randomCustomer = customersToUse[Math.floor(Math.random() * customersToUse.length)];

                const result = generateRandomOrder(
                    randomCustomer,
                    workingInventory,
                    settings.orderRules,
                    settings.apiConfig.depotId
                );

                if (result) {
                    const { order: apiRequest, totalAmount, usedProducts } = result;
                    if (usedProducts) {
                        usedProducts.forEach((qty, productId) => {
                            const productIndex = workingInventory.findIndex(p => p.id === productId);
                            if (productIndex !== -1) workingInventory[productIndex].quantity -= qty;
                        });
                    }
                    const customerId = typeof randomCustomer.id === 'string' ? parseInt(randomCustomer.id, 10) : randomCustomer.id;
                    ordersWithoutTime.push({
                        orderIndex: orderIndex++,
                        customerId,
                        customerName: randomCustomer.name,
                        customerPhone: randomCustomer.phone,
                        orderData: apiRequest,
                        totalAmount,
                        isSweep: false,
                    });
                    consecutiveFailCount = 0;
                } else {
                    consecutiveFailCount++;
                    if (consecutiveFailCount >= maxConsecutiveFails) {
                        // Flexible mode (mở rộng biên)
                        const flexibleResult = generateRandomOrder(randomCustomer, workingInventory, {
                            ...settings.orderRules,
                            minTotalAmount: Math.floor(settings.orderRules.minTotalAmount / 3),
                            maxTotalAmount: Math.floor(settings.orderRules.maxTotalAmount * 1.5),
                            maxProductsPerOrder: settings.orderRules.maxProductsPerOrder + 3,
                            maxQuantityPerProduct: settings.orderRules.maxQuantityPerProduct + 2,
                        }, settings.apiConfig.depotId);
                        if (flexibleResult) {
                            const { order: apiRequest, totalAmount, usedProducts } = flexibleResult;
                            if (usedProducts) {
                                usedProducts.forEach((qty, productId) => {
                                    const productIndex = workingInventory.findIndex(p => p.id === productId);
                                    if (productIndex !== -1) workingInventory[productIndex].quantity -= qty;
                                });
                            }
                            const customerId = typeof randomCustomer.id === 'string' ? parseInt(randomCustomer.id, 10) : randomCustomer.id;
                            ordersWithoutTime.push({
                                orderIndex: orderIndex++,
                                customerId,
                                customerName: randomCustomer.name,
                                customerPhone: randomCustomer.phone,
                                orderData: flexibleResult.order,
                                totalAmount,
                                isSweep: false,
                            });
                            consecutiveFailCount = 0;
                        } else {
                            break;
                        }
                    }
                }
            }

            // Sweep logic
            const remainingProducts = workingInventory.filter(p => p.quantity > 0);
            if (remainingProducts.length > 0) {
                const maxSweepValue = settings.orderRules.sweepMaxValue;
                let currentBatch: Product[] = [];
                let currentValue = 0;

                for (const product of remainingProducts) {
                    const productValue = product.quantity * product.price;
                    if (currentValue + productValue > maxSweepValue && currentBatch.length > 0) {
                        const randomCustomer = customersToUse[Math.floor(Math.random() * customersToUse.length)];
                        const customerId = typeof randomCustomer.id === 'string' ? parseInt(randomCustomer.id, 10) : randomCustomer.id;
                        const apiProducts: ApiProduct[] = currentBatch.map(p => ({ id: p.id, quantity: p.quantity, price: p.price }));
                        const batchTotal = currentBatch.reduce((sum, p) => sum + (p.quantity * p.price), 0);
                        const sweepOrder: ApiOrderRequest = {
                            depotId: settings.apiConfig.depotId,
                            customer: { id: customerId },
                            products: apiProducts,
                            payment: { customerAmount: batchTotal }
                        };
                        ordersWithoutTime.push({
                            orderIndex: orderIndex++,
                            customerId,
                            customerName: randomCustomer.name,
                            customerPhone: randomCustomer.phone,
                            orderData: sweepOrder,
                            totalAmount: batchTotal,
                            isSweep: true,
                        });
                        currentBatch = [];
                        currentValue = 0;
                    }
                    currentBatch.push(product);
                    currentValue += productValue;
                }
                if (currentBatch.length > 0) {
                    const randomCustomer = customersToUse[Math.floor(Math.random() * customersToUse.length)];
                    const customerId = typeof randomCustomer.id === 'string' ? parseInt(randomCustomer.id, 10) : randomCustomer.id;
                    const apiProducts: ApiProduct[] = currentBatch.map(p => ({ id: p.id, quantity: p.quantity, price: p.price }));
                    const batchTotal = currentBatch.reduce((sum, p) => sum + (p.quantity * p.price), 0);
                    const sweepOrder: ApiOrderRequest = {
                        depotId: settings.apiConfig.depotId,
                        customer: { id: customerId },
                        products: apiProducts,
                        payment: { customerAmount: batchTotal }
                    };
                    ordersWithoutTime.push({
                        orderIndex: orderIndex++,
                        customerId,
                        customerName: randomCustomer.name,
                        customerPhone: randomCustomer.phone,
                        orderData: sweepOrder,
                        totalAmount: batchTotal,
                        isSweep: true,
                    });
                }
            }
            // --- END GENERATION LOGIC ---

            // 7. Phân bổ đơn hàng cho các ngày còn lại
            toast.info(`Đang phân bổ ${ordersWithoutTime.length} đơn hàng mới...`);

            const orders: Array<{
                orderIndex: number;
                customerId: number;
                customerName: string;
                customerPhone: string;
                orderData: ApiOrderRequest;
                totalAmount: number;
                scheduledTime: Date;
            }> = [];

            const mainOrders = ordersWithoutTime.filter(o => !o.isSweep);
            const sweepOrders = ordersWithoutTime.filter(o => o.isSweep);

            const distributedMainOrders = distributeOrdersToDays(
                mainOrders,
                ordersPerDay,
                remainingStartDate,
                remainingEndDate,
                settings.timeDistribution
            );
            orders.push(...distributedMainOrders);

            if (sweepOrders.length > 0) {
                const distributedSweepOrders = distributeOrdersToDays(
                    sweepOrders,
                    ordersPerDay,
                    remainingStartDate,
                    remainingEndDate,
                    settings.timeDistribution
                );
                orders.push(...distributedSweepOrders);
            }

            orders.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

            // 8. Lưu vào Supabase
            toast.info(`Đang lưu ${orders.length} đơn hàng bổ sung vào Supabase...`);
            const batchSize = 100;
            for (let i = 0; i < orders.length; i += batchSize) {
                const batch = orders.slice(i, i + batchSize);
                await supabaseService.saveOrdersToQueue(batchId, batch);
                toast.info(`Đã lưu ${Math.min(i + batchSize, orders.length)}/${orders.length} đơn hàng...`);
            }

            onSuccess(batchId);
            toast.success('Đã điều chỉnh và bổ sung đơn hàng thành công!');

        } catch (error) {
            toast.error(`Lỗi: ${(error as Error).message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        isProcessing,
        adjustOrdersFromDate,
    };
};
