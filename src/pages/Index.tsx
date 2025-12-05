import { useState } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileSpreadsheet, Database, LayoutDashboard } from 'lucide-react';
import {
    parseCustomerFile,
    parseProductFile,
} from '@/utils/excelProcessor';
import { Customer, Product } from '@/types/excel';
import { DatePicker } from '@/components/DatePicker';
import { env } from '@/config/env';
import { validateCustomers, validateProducts } from '@/utils/validation';
import { DEFAULT_DEPOT_ID } from '@/utils/constants';
import { NhanhApiClient } from '@/services/nhanhApi';
import { validateInventory, getInventoryMap } from '@/utils/inventoryValidator';
import { InventoryValidationResult } from '@/types/inventoryTypes';
import { InventoryCheckDialog } from '@/components/InventoryCheckDialog';
import { useNavigate } from 'react-router-dom';

// Features
import { useOrderGeneration } from '@/features/order-generation/hooks/useOrderGeneration';
import { useOrderAdjustment } from '@/features/order-generation/hooks/useOrderAdjustment';
import { useOrderData } from '@/features/order-generation/hooks/useOrderData';
import { OrderList } from '@/features/order-generation/components/OrderList';
import { OrderAdjustmentSection } from '@/features/order-generation/components/OrderAdjustmentSection';

const Index = () => {
    const navigate = useNavigate();
    const [customerFile, setCustomerFile] = useState<File | null>(null);
    const [productFile, setProductFile] = useState<File | null>(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Inventory validation states
    const [inventoryCheckResult, setInventoryCheckResult] = useState<InventoryValidationResult | null>(null);
    const [showInventoryDialog, setShowInventoryDialog] = useState(false);
    const [useActualInventory, setUseActualInventory] = useState(false);
    const [isCheckingInventory, setIsCheckingInventory] = useState(false);
    const [inventoryMap, setInventoryMap] = useState<Map<number, number>>(new Map());

    // Schedule configuration
    const [scheduleConfig, setScheduleConfig] = useState<{
        startDate: Date;
        endDate: Date;
    }>({
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Mặc định: 7 ngày
    });

    // Adjust orders configuration
    const [adjustConfig, setAdjustConfig] = useState<{
        batchId: string;
        adjustFromDate: Date | null;
        adjustEndDate: Date | null;
        newTotalOrders: number;
    }>({
        batchId: '',
        adjustFromDate: null,
        adjustEndDate: null,
        newTotalOrders: 0,
    });

    // NhanhVN API client - Phải khai báo trước khi sử dụng trong hooks
    const nhanhClient = (() => {
        if (env.nhanh.appId && env.nhanh.businessId && env.nhanh.accessToken) {
            return new NhanhApiClient({
                appId: env.nhanh.appId,
                businessId: env.nhanh.businessId,
                accessToken: env.nhanh.accessToken,
            });
        }
        return null;
    })();

    // Hooks
    const {
        batchStats,
        orders,
        ordersPagination,
        isLoadingOrders,
        loadBatchStats,
        loadOrders
    } = useOrderData();

    const { isProcessing: isGenerating, handleSupabaseExport } = useOrderGeneration({
        customers,
        products,
        scheduleConfig,
        inventoryMap,
        useActualInventory,
        onSuccess: (batchId) => {
            setAdjustConfig(prev => ({ ...prev, batchId }));
            loadBatchStats(batchId);
        }
    });

    // Wrapper function để kiểm tra inventory trước khi lưu
    const handleCreateOrders = async () => {
        // Kiểm tra điều kiện cơ bản
        if (customers.length === 0 || products.length === 0) {
            toast.error('Vui lòng tải file khách hàng và sản phẩm');
            return;
        }

        if (!scheduleConfig.startDate || !scheduleConfig.endDate) {
            toast.error('Vui lòng chọn khoảng ngày');
            return;
        }

        // Nếu có NhanhVN client, kiểm tra inventory trước khi lưu
        if (nhanhClient) {
            // Nếu chưa có inventory check result hoặc muốn xác nhận lại, hiển thị modal
            if (!inventoryCheckResult) {
                await checkInventoryForProducts(products);
                return; // Dừng lại, đợi user xác nhận trong modal
            }
            // Nếu đã có result, hiển thị lại modal để xác nhận
            setShowInventoryDialog(true);
            return; // Dừng lại, đợi user xác nhận trong modal
        } else {
            // Không có NhanhVN client, lưu trực tiếp
            await handleSupabaseExport();
        }
    };

    // State để lưu thông tin điều chỉnh đang chờ xác nhận
    const [pendingAdjustment, setPendingAdjustment] = useState<{
        batchId: string;
        adjustFromDate: Date;
        adjustEndDate: Date | null;
    } | null>(null);
    const [adjustmentInventoryCheckResult, setAdjustmentInventoryCheckResult] = useState<InventoryValidationResult | null>(null);
    const [adjustmentInventoryMap, setAdjustmentInventoryMap] = useState<Map<number, number>>(new Map());
    const [showAdjustmentInventoryDialog, setShowAdjustmentInventoryDialog] = useState(false);
    const [useActualInventoryForAdjustment, setUseActualInventoryForAdjustment] = useState(false);

    const { isProcessing: isAdjusting, adjustOrdersFromDate } = useOrderAdjustment({
        customers,
        products,
        inventoryMap: adjustmentInventoryMap.size > 0 ? adjustmentInventoryMap : inventoryMap,
        useActualInventory: useActualInventoryForAdjustment,
        nhanhClient,
        onInventoryCheck: (result, invMap) => {
            setAdjustmentInventoryCheckResult(result);
            setAdjustmentInventoryMap(invMap);
            setShowAdjustmentInventoryDialog(true);
        },
        onSuccess: (batchId) => {
            loadBatchStats(batchId);
            setPendingAdjustment(null);
            setAdjustmentInventoryCheckResult(null);
            setAdjustmentInventoryMap(new Map());
        }
    });

    const handleCustomerFileUpload = async (file: File) => {
        setIsLoadingCustomer(true);
        try {
            const parsedCustomers = await parseCustomerFile(file);
            const validation = validateCustomers(parsedCustomers);
            if (!validation.valid) {
                toast.error(`Lỗi validation: ${validation.errors.slice(0, 3).join(', ')}${validation.errors.length > 3 ? '...' : ''}`);
                return;
            }
            setCustomers(parsedCustomers);
            setCustomerFile(file);
            toast.success(`Đã tải ${parsedCustomers.length} khách hàng`);
        } catch (error) {
            toast.error(`Lỗi: ${(error as Error).message}`);
        } finally {
            setIsLoadingCustomer(false);
        }
    };

    const handleProductFileUpload = async (file: File) => {
        setIsLoadingProduct(true);
        try {
            const parsedProducts = await parseProductFile(file);
            const validation = validateProducts(parsedProducts);
            if (!validation.valid) {
                toast.error(`Lỗi validation: ${validation.errors.slice(0, 3).join(', ')}${validation.errors.length > 3 ? '...' : ''}`);
                return;
            }
            setProducts(parsedProducts);
            setProductFile(file);
            toast.success(`Đã tải ${parsedProducts.length} sản phẩm`);

            if (nhanhClient && parsedProducts.length > 0) {
                await checkInventoryForProducts(parsedProducts);
            } else if (!nhanhClient) {
                toast.warning('Chưa cấu hình NhanhVN API. Bỏ qua kiểm tra tồn kho.');
            }
        } catch (error) {
            toast.error(`Lỗi: ${(error as Error).message}`);
        } finally {
            setIsLoadingProduct(false);
        }
    };

    const checkInventoryForProducts = async (productsToCheck: Product[]) => {
        setIsCheckingInventory(true);
        try {
            toast.info('Đang kiểm tra tồn kho từ NhanhVN...');
            const result = await validateInventory(productsToCheck, nhanhClient!, DEFAULT_DEPOT_ID);
            const invMap = await getInventoryMap(productsToCheck, nhanhClient!, DEFAULT_DEPOT_ID);

            setInventoryCheckResult(result);
            setInventoryMap(invMap);
            setUseActualInventory(false);
            setShowInventoryDialog(true);

            if (result.allSufficient) {
                toast.success('Tất cả sản phẩm đều có đủ tồn kho! ✓');
            } else {
                toast.warning(`Có ${result.insufficientCount + result.outOfStockCount} sản phẩm không đủ tồn kho.`);
            }
        } catch (error) {
            console.error('Error checking inventory:', error);
            toast.error(`Lỗi kiểm tra tồn kho: ${(error as Error).message}`);
        } finally {
            setIsCheckingInventory(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-5xl">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Tạo Đơn Hàng Tự Động</h1>
                    <p className="text-muted-foreground">
                        Upload file Excel khách hàng và sản phẩm để tạo đơn hàng hàng loạt
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/dashboard')}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>1. Upload Dữ Liệu</CardTitle>
                        <CardDescription>Tải lên danh sách khách hàng và sản phẩm</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <FileUploadZone
                                onFileUpload={handleCustomerFileUpload}
                                uploadedFile={customerFile}
                                isLoading={isLoadingCustomer}
                                label="File Khách Hàng (DSKH)"
                                description="Chọn file Excel chứa danh sách khách hàng"
                            />
                            {customerFile && customers.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <span>{customers.length} khách hàng đã được tải</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <FileUploadZone
                                onFileUpload={handleProductFileUpload}
                                uploadedFile={productFile}
                                isLoading={isLoadingProduct}
                                label="File Sản Phẩm (DSSP)"
                                description="Chọn file Excel chứa danh sách sản phẩm"
                            />
                            {productFile && products.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <span>{products.length} sản phẩm đã được tải</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Configuration Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>2. Cấu Hình & Tạo Đơn</CardTitle>
                        <CardDescription>Thiết lập thời gian và tạo đơn hàng</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Ngày bắt đầu</Label>
                                <DatePicker
                                    date={scheduleConfig.startDate}
                                    onDateChange={(date) => date && setScheduleConfig({ ...scheduleConfig, startDate: date })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Ngày kết thúc</Label>
                                <DatePicker
                                    date={scheduleConfig.endDate}
                                    onDateChange={(date) => date && setScheduleConfig({ ...scheduleConfig, endDate: date })}
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleCreateOrders}
                            disabled={isGenerating || customers.length === 0 || products.length === 0}
                        >
                            {isGenerating ? (
                                <>
                                    <Database className="mr-2 h-4 w-4 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <Database className="mr-2 h-4 w-4" />
                                    Tạo & Lưu Đơn Hàng
                                </>
                            )}
                        </Button>

                        {batchStats && (
                            <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                                <div className="font-medium">Kết quả Batch gần nhất:</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>Tổng đơn: {batchStats.totalOrders}</div>
                                    <div>Doanh thu: {batchStats.totalRevenue?.toLocaleString()} ₫</div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Adjustment Section */}
            <OrderAdjustmentSection
                batchId={adjustConfig.batchId}
                adjustConfig={adjustConfig}
                setAdjustConfig={setAdjustConfig}
                onAdjust={() => {
                    if (adjustConfig.adjustFromDate) {
                        setPendingAdjustment({
                            batchId: adjustConfig.batchId,
                            adjustFromDate: adjustConfig.adjustFromDate,
                            adjustEndDate: adjustConfig.adjustEndDate
                        });
                        adjustOrdersFromDate(
                            adjustConfig.batchId,
                            adjustConfig.adjustFromDate,
                            adjustConfig.adjustEndDate,
                            false // skipInventoryCheck = false để kiểm tra inventory
                        );
                    }
                }}
                isProcessing={isAdjusting}
                onLoadStats={loadBatchStats}
            />

            {/* Order List Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Danh Sách Đơn Hàng</CardTitle>
                    <CardDescription>
                        {batchStats?.batch ? `Batch: ${batchStats.batch.id}` : 'Chưa chọn batch'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <OrderList
                        orders={orders}
                        isLoading={isLoadingOrders}
                        pagination={ordersPagination}
                        onPageChange={(page) => loadOrders(adjustConfig.batchId || '', page)}
                    />
                </CardContent>
            </Card>

            <InventoryCheckDialog
                open={showInventoryDialog}
                onOpenChange={(open) => {
                    setShowInventoryDialog(open);
                    if (!open) {
                        // Nếu đóng modal mà chưa xác nhận, reset
                        setUseActualInventory(false);
                    }
                }}
                result={inventoryCheckResult}
                onContinueWithExcel={async () => {
                    setUseActualInventory(false);
                    setShowInventoryDialog(false);
                    toast.info('Đã chọn: Sử dụng số lượng từ file Excel');
                    // Sau khi xác nhận, mới gọi handleSupabaseExport
                    await handleSupabaseExport();
                }}
                onUseActualInventory={async () => {
                    setUseActualInventory(true);
                    setShowInventoryDialog(false);
                    toast.info('Đã chọn: Sử dụng tồn kho thực tế từ NhanhVN');
                    // Sau khi xác nhận, mới gọi handleSupabaseExport
                    await handleSupabaseExport();
                }}
                onCancel={() => {
                    setShowInventoryDialog(false);
                    setUseActualInventory(false);
                }}
            />

            {/* Modal xác nhận inventory cho điều chỉnh đơn hàng */}
            <InventoryCheckDialog
                open={showAdjustmentInventoryDialog}
                onOpenChange={(open) => {
                    setShowAdjustmentInventoryDialog(open);
                    if (!open) {
                        setUseActualInventoryForAdjustment(false);
                        setPendingAdjustment(null);
                    }
                }}
                result={adjustmentInventoryCheckResult}
                onContinueWithExcel={async () => {
                    setUseActualInventoryForAdjustment(false);
                    setShowAdjustmentInventoryDialog(false);
                    toast.info('Đã chọn: Sử dụng số lượng từ file Excel (đã trừ đơn đã hoàn thành)');
                    // Tiếp tục điều chỉnh với skipInventoryCheck = true
                    if (pendingAdjustment) {
                        await adjustOrdersFromDate(
                            pendingAdjustment.batchId,
                            pendingAdjustment.adjustFromDate,
                            pendingAdjustment.adjustEndDate,
                            true, // skipInventoryCheck = true vì đã xác nhận
                            undefined, // không dùng inventoryMap
                            false // không dùng actual inventory
                        );
                    }
                }}
                onUseActualInventory={async () => {
                    setUseActualInventoryForAdjustment(true);
                    setShowAdjustmentInventoryDialog(false);
                    toast.info('Đã chọn: Sử dụng tồn kho thực tế từ NhanhVN');
                    // Tiếp tục điều chỉnh với skipInventoryCheck = true và inventoryMap đã xác nhận
                    if (pendingAdjustment) {
                        await adjustOrdersFromDate(
                            pendingAdjustment.batchId,
                            pendingAdjustment.adjustFromDate,
                            pendingAdjustment.adjustEndDate,
                            true, // skipInventoryCheck = true vì đã xác nhận
                            adjustmentInventoryMap, // dùng inventoryMap đã xác nhận
                            true // dùng actual inventory
                        );
                    }
                }}
                onCancel={() => {
                    setShowAdjustmentInventoryDialog(false);
                    setUseActualInventoryForAdjustment(false);
                    setPendingAdjustment(null);
                }}
            />
        </div>
    );
};

export default Index;
