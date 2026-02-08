import { useState } from 'react';
import { toast } from 'sonner';
import { SupabaseService } from '@/services/supabase';
import { Customer, Product } from '@/types/excel';
import { ApiOrderRequest, ApiProduct } from '@/types/api';
import { adjustProductsToInventory } from '@/utils/inventoryValidator';
import { calculateTotalOrders } from '@/utils/orderUtils';
import { calculateOrdersPerDay, distributeOrdersToDays } from '@/utils/timeDistribution';
import { generateRandomOrder } from '@/utils/orderGenerator';
import { env } from '@/config/env';
import { useSettings } from '@/contexts/SettingsContext';

interface UseOrderGenerationProps {
    customers: Customer[];
    products: Product[];
    scheduleConfig: {
        startDate: Date;
        endDate: Date;
    };
    inventoryMap: Map<number, number>;
    useActualInventory: boolean;
    onSuccess: (batchId: string) => void;
}

export const useOrderGeneration = ({
    customers,
    products,
    scheduleConfig,
    inventoryMap,
    useActualInventory,
    onSuccess,
}: UseOrderGenerationProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; phase: string }>({
        current: 0, total: 0, phase: '',
    });
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

    const handleSupabaseExport = async () => {
        if (!supabaseConfig) {
            toast.error('Vui lòng cấu hình Supabase trong file .env');
            return;
        }

        if (!scheduleConfig.startDate || !scheduleConfig.endDate) {
            toast.error('Vui lòng chọn khoảng ngày');
            return;
        }

        if (customers.length === 0 || products.length === 0) {
            toast.error('Vui lòng tải file khách hàng và sản phẩm');
            return;
        }

        // Adjust products based on user choice
        let productsToUse = products;
        if (useActualInventory && inventoryMap.size > 0) {
            productsToUse = adjustProductsToInventory(products, inventoryMap);
            toast.info('Sử dụng số lượng tồn kho thực tế từ NhanhVN');
            console.log('📦 Using adjusted inventory:', productsToUse.map(p => ({ id: p.id, original: products.find(op => op.id === p.id)?.quantity, adjusted: p.quantity })));
        }

        // Tính số lượng đơn hàng tự động từ sản phẩm
        const totalOrders = calculateTotalOrders(
            productsToUse,
            settings.orderRules.minTotalAmount,
            settings.orderRules.maxTotalAmount
        );

        if (totalOrders <= 0) {
            toast.error('Không thể tính số lượng đơn hàng từ sản phẩm');
            return;
        }

        setIsProcessing(true);
        setProgress({ current: 0, total: 3, phase: 'Đang tạo đơn hàng...' });
        try {
            const supabaseService = new SupabaseService(supabaseConfig);

            // 1. Tạo batch (lưu kèm thông tin sản phẩm)
            const batch = await supabaseService.createBatch(
                scheduleConfig.startDate,
                scheduleConfig.endDate,
                totalOrders,
                productsToUse // Lưu thông tin sản phẩm (đã điều chỉnh nếu cần) vào batch
            );
            const batchId = batch.id;

            // 2. Tính số lượng đơn hàng cho mỗi ngày (ưu tiên cuối tuần) - chỉ để tham khảo
            const ordersPerDay = calculateOrdersPerDay(
                totalOrders,
                scheduleConfig.startDate,
                scheduleConfig.endDate
            );

            console.log('Phân bổ đơn hàng theo ngày (tham khảo):', ordersPerDay.map(d => ({
                date: d.date.toLocaleDateString('vi-VN'),
                count: d.orderCount
            })));

            // 3. Tạo TẤT CẢ đơn hàng trước (chưa gán scheduledTime)
            const ordersWithoutTime: Array<{
                orderIndex: number;
                customerId: number;
                customerName: string;
                customerPhone: string;
                orderData: ApiOrderRequest;
                totalAmount: number;
                scheduledTime?: Date;
                isSweep?: boolean; // Đánh dấu đơn vét
            }> = [];

            let orderIndex = 0;

            // Create a deep copy of products to track inventory
            const currentInventory = productsToUse.map(p => ({ ...p }));

            toast.info(`Đang tạo đơn hàng (tự động tính từ ${productsToUse.length} sản phẩm)...`);

            // Tạo đơn hàng chính cho đến khi hết inventory hoặc không thể tạo thêm
            let consecutiveFailCount = 0;
            const maxConsecutiveFails = settings.orderRules.maxConsecutiveFails;

            while (currentInventory.some(p => p.quantity > 0)) {
                const availableProducts = currentInventory.filter(p => p.quantity > 0);
                if (availableProducts.length === 0) {
                    break;
                }

                // Nếu giá trị còn lại < minTotalAmount, dừng để vét sau
                const totalRemainingValue = availableProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0);
                if (totalRemainingValue < settings.orderRules.minTotalAmount) {
                    console.log(`Total remaining value < ${settings.orderRules.minTotalAmount}, switching to sweep logic...`);
                    break;
                }

                // Random chọn khách hàng
                const randomCustomer = customers[Math.floor(Math.random() * customers.length)];

                // Try to create order with settings config
                const result = generateRandomOrder(
                    randomCustomer,
                    currentInventory,
                    settings.orderRules,
                    settings.apiConfig.depotId
                );

                if (result) {
                    const { order: apiRequest, totalAmount, usedProducts } = result;

                    // Decrement inventory
                    if (usedProducts) {
                        usedProducts.forEach((qty, productId) => {
                            const productIndex = currentInventory.findIndex(p => p.id === productId);
                            if (productIndex !== -1) {
                                currentInventory[productIndex].quantity -= qty;
                            }
                        });
                    }

                    const customerId = typeof randomCustomer.id === 'string'
                        ? parseInt(randomCustomer.id, 10)
                        : randomCustomer.id;

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

                    // Sau một số lần thất bại, thử flexible mode (mở rộng biên)
                    if (consecutiveFailCount >= maxConsecutiveFails) {
                        const flexibleResult = generateRandomOrder(randomCustomer, currentInventory, {
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
                                    const productIndex = currentInventory.findIndex(p => p.id === productId);
                                    if (productIndex !== -1) {
                                        currentInventory[productIndex].quantity -= qty;
                                    }
                                });
                            }

                            const customerId = typeof randomCustomer.id === 'string'
                                ? parseInt(randomCustomer.id, 10)
                                : randomCustomer.id;

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
                            break; // Không thể tạo thêm đơn
                        }
                    }
                }
            }

            console.log(`✅ Đã tạo ${ordersWithoutTime.length} đơn hàng (chưa phân bổ thời gian)`);
            console.log(`📦 Inventory còn lại:`, currentInventory.filter(p => p.quantity > 0).length, 'sản phẩm');

            setProgress({ current: 1, total: 3, phase: 'Đang vét sản phẩm còn lại...' });

            // 4. Vét các sản phẩm còn thừa (nếu có) - Tạo đơn vét (chưa gán thời gian)
            const remainingProducts = currentInventory.filter(p => p.quantity > 0);
            if (remainingProducts.length > 0) {
                const totalRemainingValue = remainingProducts.reduce((sum, p) => sum + (p.quantity * p.price), 0);
                toast.info(`Đang tạo đơn vét cho ${remainingProducts.length} sản phẩm (${totalRemainingValue.toLocaleString()} VNĐ)...`);

                const maxSweepValue = settings.orderRules.sweepMaxValue;

                // Tạo các đơn vét
                let currentBatch: Product[] = [];
                let currentValue = 0;

                for (const product of remainingProducts) {
                    const productValue = product.quantity * product.price;

                    // Nếu thêm sản phẩm này vượt quá max, tạo đơn với batch hiện tại
                    if (currentValue + productValue > maxSweepValue && currentBatch.length > 0) {
                        // Tạo đơn từ batch hiện tại
                        const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
                        const customerId = typeof randomCustomer.id === 'string'
                            ? parseInt(randomCustomer.id, 10)
                            : randomCustomer.id;

                        const apiProducts: ApiProduct[] = currentBatch.map(p => ({
                            id: p.id,
                            quantity: p.quantity,
                            price: p.price
                        }));

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
                            isSweep: true, // Đánh dấu đơn vét
                        });

                        currentBatch = [];
                        currentValue = 0;
                    }

                    currentBatch.push(product);
                    currentValue += productValue;
                }

                // Tạo đơn vét cuối cùng với batch còn lại
                if (currentBatch.length > 0) {
                    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
                    const customerId = typeof randomCustomer.id === 'string'
                        ? parseInt(randomCustomer.id, 10)
                        : randomCustomer.id;

                    const apiProducts: ApiProduct[] = currentBatch.map(p => ({
                        id: p.id,
                        quantity: p.quantity,
                        price: p.price
                    }));

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
                        isSweep: true, // Đánh dấu đơn vét
                    });
                }

                // Clear inventory
                remainingProducts.forEach(p => p.quantity = 0);

                const sweepCount = ordersWithoutTime.filter(o => o.isSweep).length;
                toast.success(`Đã tạo ${sweepCount} đơn vét để vét cạn số lượng sản phẩm còn lại`);
            }

            // 5. Phân bổ tất cả đơn hàng cho các ngày
            setProgress({ current: 2, total: 3, phase: 'Đang phân bổ thời gian...' });
            toast.info(`Đang phân bổ ${ordersWithoutTime.length} đơn hàng cho các ngày...`);

            const orders: Array<{
                orderIndex: number;
                customerId: number;
                customerName: string;
                customerPhone: string;
                orderData: ApiOrderRequest;
                totalAmount: number;
                scheduledTime: Date;
            }> = [];

            // Tách đơn hàng chính và đơn vét
            const mainOrders = ordersWithoutTime.filter(o => !o.isSweep);
            const sweepOrders = ordersWithoutTime.filter(o => o.isSweep);

            console.log(`📊 Phân bổ đơn hàng:`);
            console.log(`  - Đơn hàng chính: ${mainOrders.length}`);
            console.log(`  - Đơn vét: ${sweepOrders.length}`);
            console.log(`  - Tổng số ngày cần phân bổ: ${ordersPerDay.length} ngày (${scheduleConfig.startDate.toLocaleDateString('vi-VN')} - ${scheduleConfig.endDate.toLocaleDateString('vi-VN')})`);

            // Phân bổ đơn hàng chính theo weight (ưu tiên cuối tuần và khung giờ cao điểm)
            console.log(`🔄 Đang phân bổ ${mainOrders.length} đơn hàng chính...`);
            const distributedMainOrders = distributeOrdersToDays(
                mainOrders,
                ordersPerDay,
                scheduleConfig.startDate,
                scheduleConfig.endDate,
                false
            );
            orders.push(...distributedMainOrders);

            // Log phân bổ đơn chính theo ngày
            const mainOrdersByDay = new Map<string, number>();
            distributedMainOrders.forEach(order => {
                const dateKey = order.scheduledTime.toLocaleDateString('vi-VN');
                mainOrdersByDay.set(dateKey, (mainOrdersByDay.get(dateKey) || 0) + 1);
            });
            console.log(`✅ Phân bổ đơn chính theo ngày:`, Array.from(mainOrdersByDay.entries()).map(([date, count]) => ({ date, count })));

            // Phân bổ đơn vét vào khung giờ cao điểm cuối tuần (hoặc gần cuối tuần)
            if (sweepOrders.length > 0) {
                console.log(`🔄 Đang phân bổ ${sweepOrders.length} đơn vét vào khung giờ cao điểm cuối tuần...`);
                const distributedSweepOrders = distributeOrdersToDays(
                    sweepOrders,
                    ordersPerDay,
                    scheduleConfig.startDate,
                    scheduleConfig.endDate,
                    true // isSweepOrder = true
                );
                orders.push(...distributedSweepOrders);

                // Log phân bổ đơn vét theo ngày
                const sweepOrdersByDay = new Map<string, number>();
                distributedSweepOrders.forEach(order => {
                    const dateKey = order.scheduledTime.toLocaleDateString('vi-VN');
                    sweepOrdersByDay.set(dateKey, (sweepOrdersByDay.get(dateKey) || 0) + 1);
                });
                console.log(`✅ Phân bổ đơn vét theo ngày:`, Array.from(sweepOrdersByDay.entries()).map(([date, count]) => ({ date, count })));
            }

            // Sắp xếp lại theo scheduledTime
            orders.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

            // Log phân bổ tổng hợp theo ngày
            const ordersByDay = new Map<string, { count: number; totalAmount: number }>();
            orders.forEach(order => {
                const dateKey = order.scheduledTime.toLocaleDateString('vi-VN');
                const current = ordersByDay.get(dateKey) || { count: 0, totalAmount: 0 };
                ordersByDay.set(dateKey, {
                    count: current.count + 1,
                    totalAmount: current.totalAmount + order.totalAmount
                });
            });

            console.log(`📈 TỔNG HỢP PHÂN BỔ ĐƠN HÀNG THEO NGÀY:`);
            Array.from(ordersByDay.entries())
                .sort((a, b) => new Date(a[0].split('/').reverse().join('-')).getTime() - new Date(b[0].split('/').reverse().join('-')).getTime())
                .forEach(([date, stats]) => {
                    console.log(`  ${date}: ${stats.count} đơn, ${stats.totalAmount.toLocaleString('vi-VN')} ₫`);
                });

            // Kiểm tra xem có ngày nào thiếu đơn không
            const allDays = ordersPerDay.map(d => d.date.toLocaleDateString('vi-VN'));
            const daysWithOrders = Array.from(ordersByDay.keys());
            const missingDays = allDays.filter(day => !daysWithOrders.includes(day));
            if (missingDays.length > 0) {
                console.warn(`⚠️ CẢNH BÁO: Các ngày sau KHÔNG có đơn hàng:`, missingDays);
            } else {
                console.log(`✅ Tất cả các ngày đều có đơn hàng!`);
            }

            if (currentInventory.some(p => p.quantity > 0)) {
                const remainingItems = currentInventory.reduce((sum, p) => sum + p.quantity, 0);
                toast.warning(
                    `Đã tạo ${orders.length} đơn hàng. ` +
                    `Vẫn còn ${remainingItems} sản phẩm chưa được phân bổ (do không đủ ghép thành đơn > ${settings.orderRules.minTotalAmount.toLocaleString()}).`
                );
            } else {
                toast.success(`Đã phân bổ hết toàn bộ sản phẩm vào ${orders.length} đơn hàng.`);
            }

            // 4. Lưu vào Supabase (chia nhỏ để tránh timeout)
            setProgress({ current: 3, total: 3, phase: 'Đang lưu vào database...' });
            toast.info(`Đang lưu ${orders.length} đơn hàng vào Supabase...`);
            const batchSize = 100;
            for (let i = 0; i < orders.length; i += batchSize) {
                const batch = orders.slice(i, i + batchSize);
                await supabaseService.saveOrdersToQueue(batchId, batch);
                toast.info(`Đã lưu ${Math.min(i + batchSize, orders.length)}/${orders.length} đơn hàng...`);
            }

            setProgress({ current: 3, total: 3, phase: 'Hoàn thành!' });
            onSuccess(batchId);
            toast.success(
                `Đã lưu ${orders.length} đơn hàng vào Supabase thành công! ` +
                `Batch ID: ${batchId}`
            );

        } catch (error) {
            toast.error(`Lỗi: ${(error as Error).message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        isProcessing,
        progress,
        handleSupabaseExport,
    };
};
