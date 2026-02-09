import { useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseService } from '@/services/supabase';
import { Customer, Product } from '@/types/excel';
import { ApiOrderRequest, ApiProduct } from '@/types/api';
import { adjustProductsToInventory } from '@/utils/inventoryValidator';
import { calculateTotalOrders } from '@/utils/orderUtils';
import { calculateOrdersPerDay, distributeOrdersToDays } from '@/utils/timeDistribution';
import { generateRandomOrder } from '@/utils/orderGenerator';
import { useSettings } from '@/contexts/SettingsContext';
import { getActiveDepot } from '@/types/settings';

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
    onPhaseChange?: (phase: string) => void;
}

export const useOrderGeneration = ({
    customers,
    products,
    scheduleConfig,
    inventoryMap,
    useActualInventory,
    onSuccess,
    onPhaseChange,
}: UseOrderGenerationProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; phase: string }>({
        current: 0, total: 0, phase: '',
    });
    const { settings } = useSettings();

    const handleSupabaseExport = async () => {
        const supabaseService = getSupabaseService();
        if (!supabaseService) {
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
        const activeDepot = getActiveDepot(settings.apiConfig);
        const depotLabel = activeDepot.name || `Depot ${activeDepot.depotId}`;
        toast.info(`Đang tạo đơn cho kho: ${depotLabel} (ID: ${activeDepot.depotId})`);
        setProgress({ current: 0, total: 3, phase: `Đang tạo đơn hàng cho ${depotLabel}...` });
        onPhaseChange?.('create_orders');
        try {
            // supabaseService already checked above

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

                    // Sau một số lần thất bại, thử flexible mode (nới nhẹ biên, tránh bimodal)
                    if (consecutiveFailCount >= maxConsecutiveFails) {
                        const flexibleResult = generateRandomOrder(randomCustomer, currentInventory, {
                            ...settings.orderRules,
                            minTotalAmount: Math.floor(settings.orderRules.minTotalAmount * 0.7),
                            maxTotalAmount: Math.floor(settings.orderRules.maxTotalAmount * 1.2),
                            maxProductsPerOrder: settings.orderRules.maxProductsPerOrder + 2,
                            maxQuantityPerProduct: settings.orderRules.maxQuantityPerProduct + 1,
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

            setProgress({ current: 1, total: 3, phase: 'Đang vét sản phẩm còn lại...' });
            onPhaseChange?.('sweep');

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
            onPhaseChange?.('distribute');
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

            // Phân bổ đơn hàng chính theo weight (ưu tiên cuối tuần và khung giờ cao điểm)
            const distributedMainOrders = distributeOrdersToDays(
                mainOrders,
                ordersPerDay,
                scheduleConfig.startDate,
                scheduleConfig.endDate,
                false
            );
            orders.push(...distributedMainOrders);

            // Phân bổ đơn vét vào khung giờ cao điểm cuối tuần (hoặc gần cuối tuần)
            if (sweepOrders.length > 0) {
                const distributedSweepOrders = distributeOrdersToDays(
                    sweepOrders,
                    ordersPerDay,
                    scheduleConfig.startDate,
                    scheduleConfig.endDate,
                    true // isSweepOrder = true
                );
                orders.push(...distributedSweepOrders);
            }

            // Sắp xếp lại theo scheduledTime
            orders.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

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
            onPhaseChange?.('save_db');
            toast.info(`Đang lưu ${orders.length} đơn hàng vào Supabase...`);
            const batchSize = 100;
            for (let i = 0; i < orders.length; i += batchSize) {
                const batch = orders.slice(i, i + batchSize);
                await supabaseService.saveOrdersToQueue(batchId, batch);
                toast.info(`Đã lưu ${Math.min(i + batchSize, orders.length)}/${orders.length} đơn hàng...`);
            }

            // Cập nhật total_orders thực tế (có thể khác estimate ban đầu do sweep)
            await supabaseService.updateBatchTotalOrders(batchId, orders.length);

            setProgress({ current: 3, total: 3, phase: 'Hoàn thành!' });
            onSuccess(batchId);
            toast.success(
                `Đã tạo ${orders.length} đơn nháp thành công! ` +
                `Vui lòng review và duyệt để đơn được xử lý. Batch: ${batchId}`
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
