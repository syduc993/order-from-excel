import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { FileUploadZone } from '@/components/FileUploadZone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileSpreadsheet, Database, Info, Users, Upload, Loader2, ExternalLink } from 'lucide-react';
import { OrderCreationProgress, OrderCreationStep } from '@/components/OrderCreationProgress';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    parseCustomerFile,
    parseProductFile,
} from '@/utils/excelProcessor';
import { Customer, Product } from '@/types/excel';
import { DatePicker } from '@/components/DatePicker';
import { validateCustomers, validateProducts } from '@/utils/validation';
import { NhanhApiClient } from '@/services/nhanhApi';
import { validateInventory, getInventoryMap } from '@/utils/inventoryValidator';
import { InventoryValidationResult } from '@/types/inventoryTypes';
import { InventoryCheckDialog } from '@/components/InventoryCheckDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getSupabaseService } from '@/services/supabase';

// Features
import { useOrderGeneration } from '@/features/order-generation/hooks/useOrderGeneration';
import { customerItemToCustomer } from '@/utils/dataConversion';

const Index = () => {
    const { user, canCreate } = useAuth();

    // H1: View-only users land on Dashboard instead
    if (!canCreate) {
        return <Navigate to="/dashboard" replace />;
    }
    const { settings } = useSettings();
    const [customerSource, setCustomerSource] = useState<'db' | 'file'>('db');
    const [customerFile, setCustomerFile] = useState<File | null>(null);
    const [productFile, setProductFile] = useState<File | null>(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [dbCustomerCount, setDbCustomerCount] = useState<number | null>(null);

    // Inventory validation states
    const [inventoryCheckResult, setInventoryCheckResult] = useState<InventoryValidationResult | null>(null);
    const [showInventoryDialog, setShowInventoryDialog] = useState(false);
    const [useActualInventory, setUseActualInventory] = useState(false);
    const [isCheckingInventory, setIsCheckingInventory] = useState(false);
    const [inventoryMap, setInventoryMap] = useState<Map<number, number>>(new Map());
    const [inventoryDialogMode, setInventoryDialogMode] = useState<'preview' | 'action'>('action');

    // Schedule configuration
    const [scheduleConfig, setScheduleConfig] = useState<{
        startDate: Date;
        endDate: Date;
    }>({
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // UI state
    const [isCreatingOrders, setIsCreatingOrders] = useState(false);
    const [creationSteps, setCreationSteps] = useState<OrderCreationStep[]>([]);
    const [lastCreatedBatchId, setLastCreatedBatchId] = useState<string | null>(null);

    // Step progress helper
    const updateStep = useCallback((stepId: string, status: OrderCreationStep['status'], detail?: string) => {
        setCreationSteps(prev => prev.map(s =>
            s.id === stepId ? { ...s, status, detail: detail ?? s.detail } : s
        ));
    }, []);

    // NhanhVN API client (memoized to avoid recreating on every render)
    const nhanhClient = useMemo(() => {
        const { nhanhAppId, nhanhBusinessId, nhanhAccessToken } = settings.apiConfig;
        if (nhanhAppId && nhanhBusinessId && nhanhAccessToken) {
            return new NhanhApiClient({
                appId: nhanhAppId,
                businessId: nhanhBusinessId,
                accessToken: nhanhAccessToken,
            });
        }
        return null;
    }, [settings.apiConfig.nhanhAppId, settings.apiConfig.nhanhBusinessId, settings.apiConfig.nhanhAccessToken]);

    const GENERATION_PHASES: Record<string, string> = {
        create_orders: 'Tạo đơn hàng',
        sweep: 'Vét sản phẩm còn lại',
        distribute: 'Phân bổ thời gian',
        save_db: 'Lưu vào database',
    };
    const GENERATION_PHASE_ORDER = ['create_orders', 'sweep', 'distribute', 'save_db'];

    const { isProcessing: isGenerating, progress, handleSupabaseExport } = useOrderGeneration({
        customers,
        products,
        scheduleConfig,
        inventoryMap,
        useActualInventory,
        onPhaseChange: (phase) => {
            setCreationSteps(prev => {
                const existing = prev.map(s => s.id);
                let newSteps = [...prev];

                // Add generation steps if not yet present
                for (const stepId of GENERATION_PHASE_ORDER) {
                    if (!existing.includes(stepId)) {
                        newSteps.push({
                            id: stepId,
                            label: GENERATION_PHASES[stepId],
                            status: 'pending',
                        });
                    }
                }

                // Update statuses
                const phaseIdx = GENERATION_PHASE_ORDER.indexOf(phase);
                return newSteps.map(s => {
                    const sIdx = GENERATION_PHASE_ORDER.indexOf(s.id);
                    if (sIdx === -1) return s; // non-generation step, keep as-is
                    if (sIdx < phaseIdx) return { ...s, status: 'completed' as const };
                    if (sIdx === phaseIdx) return { ...s, status: 'in_progress' as const };
                    return s;
                });
            });
        },
        onSuccess: (batchId) => {
            setLastCreatedBatchId(batchId);
            setIsCreatingOrders(false);
            setCreationSteps([]);
        }
    });

    // Prevent accidental page close during order creation
    useEffect(() => {
        if (isCreatingOrders || isGenerating) {
            const handler = (e: BeforeUnloadEvent) => {
                e.preventDefault();
                e.returnValue = 'Đang tạo đơn hàng. Bạn có chắc muốn rời khỏi trang?';
                return e.returnValue;
            };
            window.addEventListener('beforeunload', handler);
            return () => window.removeEventListener('beforeunload', handler);
        }
    }, [isCreatingOrders, isGenerating]);

    // Reset creation flow state when generation finishes (including on error)
    useEffect(() => {
        if (!isGenerating && isCreatingOrders && creationSteps.some(s => s.id === 'save_db' || s.id === 'create_orders')) {
            setIsCreatingOrders(false);
            setCreationSteps([]);
        }
    }, [isGenerating]);

    // Wrapper function to check inventory before saving
    const handleCreateOrders = async () => {
        if (products.length === 0) {
            toast.error('Vui lòng tải file sản phẩm');
            return;
        }

        // Build initial steps based on what's needed
        const needsCustomerLoad = customers.length === 0 && customerSource === 'db' && dbCustomerCount && dbCustomerCount > 0;
        const needsInventoryCheck = !!nhanhClient;
        const initialSteps: OrderCreationStep[] = [];
        if (needsCustomerLoad) {
            initialSteps.push({ id: 'load_customers', label: 'Tải khách hàng', status: 'pending' });
        }
        if (needsInventoryCheck) {
            initialSteps.push({ id: 'check_inventory', label: 'Kiểm tra tồn kho', status: inventoryCheckResult ? 'completed' : 'pending' });
        }
        setCreationSteps(initialSteps);
        setIsCreatingOrders(true);
        setLastCreatedBatchId(null);

        try {
            // Lazy-load customers from DB if not yet loaded
            let activeCustomers = customers;
            if (needsCustomerLoad) {
                updateStep('load_customers', 'in_progress', `0 / ${dbCustomerCount?.toLocaleString()}`);
                activeCustomers = await loadCustomersFromDb();
                updateStep('load_customers', 'completed', `${activeCustomers.length.toLocaleString()} khách hàng`);
            }
            if (activeCustomers.length === 0) {
                toast.error('Vui lòng chọn khách hàng');
                setIsCreatingOrders(false);
                setCreationSteps([]);
                return;
            }
            if (!scheduleConfig.startDate || !scheduleConfig.endDate) {
                toast.error('Vui lòng chọn khoảng ngày');
                setIsCreatingOrders(false);
                setCreationSteps([]);
                return;
            }
            if (nhanhClient) {
                if (!inventoryCheckResult) {
                    updateStep('check_inventory', 'in_progress');
                    await checkInventoryForProducts(products);
                    updateStep('check_inventory', 'completed');
                }
                setInventoryDialogMode('action');
                setShowInventoryDialog(true);
                // Flow continues when user clicks action button in dialog
                // Don't reset isCreatingOrders here - it resets in onSuccess or on cancel
                return;
            } else {
                await handleSupabaseExport();
            }
        } catch (error) {
            toast.error(`Lỗi: ${(error as Error).message}`);
            setIsCreatingOrders(false);
            setCreationSteps([]);
        }
    };

    const handleCustomerFileUpload = async (file: File) => {
        setIsLoadingCustomer(true);
        try {
            const parsedCustomers = await parseCustomerFile(file, settings.excelConfig.customerSheetName);
            const validation = validateCustomers(parsedCustomers);
            if (!validation.valid) {
                toast.error(
                    `Lỗi validation (${validation.errors.length} lỗi): ${validation.errors.slice(0, 5).join('; ')}${validation.errors.length > 5 ? ` ...và ${validation.errors.length - 5} lỗi khác` : ''}`,
                    { duration: Infinity }
                );
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
            const parsedProducts = await parseProductFile(file, settings.excelConfig.productSheetName);
            const validation = validateProducts(parsedProducts);
            if (!validation.valid) {
                toast.error(
                    `Lỗi validation (${validation.errors.length} lỗi): ${validation.errors.slice(0, 5).join('; ')}${validation.errors.length > 5 ? ` ...và ${validation.errors.length - 5} lỗi khác` : ''}`,
                    { duration: Infinity }
                );
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

    /** Quick count only — runs on mount */
    const loadCustomerCount = useCallback(async () => {
        try {
            const service = getSupabaseService();
            if (!service) return;
            const list = await service.getOrCreateDefaultCustomerList(user?.email);
            setDbCustomerCount(list.item_count);
        } catch (error) {
            toast.error(`Lỗi tải KH: ${(error as Error).message}`);
        }
    }, [user?.email]);

    /** Load full customer data from Supabase — called on demand (generate) or reload.
     *  Returns the loaded customers so callers can use them immediately. */
    const loadCustomersFromDb = useCallback(async (): Promise<Customer[]> => {
        setIsLoadingCustomer(true);
        try {
            const service = getSupabaseService();
            if (!service) { toast.error('Supabase chưa cấu hình'); return []; }
            const list = await service.getOrCreateDefaultCustomerList(user?.email);
            setDbCustomerCount(list.item_count);

            if (list.item_count === 0) {
                toast.warning('Chưa có khách hàng trong hệ thống. Vào trang Khách Hàng để import.');
                return [];
            }

            const items = await service.getCustomerItems(list.id, list.item_count);
            const parsed = items.map(customerItemToCustomer);
            const validation = validateCustomers(parsed);
            if (!validation.valid) {
                toast.error(`Lỗi dữ liệu KH: ${validation.errors.slice(0, 3).join('; ')}`);
                return [];
            }
            setCustomers(parsed);
            setDbCustomerCount(parsed.length);
            toast.success(`Đã tải ${parsed.length} khách hàng từ hệ thống`);
            return parsed;
        } catch (error) {
            toast.error(`Lỗi tải KH: ${(error as Error).message}`);
            return [];
        } finally {
            setIsLoadingCustomer(false);
        }
    }, [user?.email]);

    // On mount: only load count (fast, 1 query). Full data loads on demand.
    useEffect(() => {
        if (customerSource === 'db') {
            loadCustomerCount();
        }
    }, [customerSource, loadCustomerCount]);

    const checkInventoryForProducts = async (productsToCheck: Product[]) => {
        setIsCheckingInventory(true);
        try {
            toast.info('Đang kiểm tra tồn kho từ NhanhVN...');
            const result = await validateInventory(productsToCheck, nhanhClient!, settings.apiConfig.depotId);
            const invMap = await getInventoryMap(productsToCheck, nhanhClient!, settings.apiConfig.depotId);
            setInventoryCheckResult(result);
            setInventoryMap(invMap);
            setUseActualInventory(false);
            if (result.allSufficient) {
                toast.success('Tất cả sản phẩm đều có đủ tồn kho!');
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
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Tạo Đơn Hàng Tự Động</h1>
                <p className="text-muted-foreground">
                    Chọn khách hàng và upload sản phẩm để tạo đơn hàng hàng loạt
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            1. Chọn Dữ Liệu
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                    <p>Chọn khách hàng từ hệ thống hoặc upload file. Sản phẩm cần upload file Excel mỗi lần.</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                        <CardDescription>Chọn khách hàng và tải file sản phẩm</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Customer source selection */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Khách Hàng</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={customerSource === 'db' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => { setCustomerSource('db'); setCustomerFile(null); }}
                                    className="flex-1"
                                >
                                    <Users className="mr-1.5 h-3.5 w-3.5" />
                                    Từ hệ thống
                                </Button>
                                <Button
                                    variant={customerSource === 'file' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => { setCustomerSource('file'); setCustomers([]); }}
                                    className="flex-1"
                                >
                                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                                    Upload file
                                </Button>
                            </div>

                            {customerSource === 'db' ? (
                                <div className="space-y-2">
                                    {isLoadingCustomer ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                                            <Database className="h-4 w-4 animate-spin" />
                                            <span>
                                                Đang tải {dbCustomerCount != null && dbCustomerCount > 0
                                                    ? <strong>{dbCustomerCount.toLocaleString()}</strong>
                                                    : ''} khách hàng...
                                            </span>
                                        </div>
                                    ) : customers.length > 0 ? (
                                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                            <div className="flex items-center gap-2 text-sm text-green-700">
                                                <Users className="h-4 w-4" />
                                                <span><strong>{customers.length.toLocaleString()}</strong> khách hàng đã sẵn sàng</span>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={loadCustomersFromDb} className="h-7 text-xs">
                                                Tải lại
                                            </Button>
                                        </div>
                                    ) : dbCustomerCount != null && dbCustomerCount > 0 ? (
                                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                            <div className="flex items-center gap-2 text-sm text-blue-700">
                                                <Database className="h-4 w-4" />
                                                <span><strong>{dbCustomerCount.toLocaleString()}</strong> khách hàng trong hệ thống</span>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={loadCustomersFromDb} className="h-7 text-xs">
                                                Tải trước
                                            </Button>
                                        </div>
                                    ) : dbCustomerCount === 0 ? (
                                        <div className="flex items-center gap-2 text-sm text-amber-600 p-3 bg-amber-50 rounded-lg">
                                            <Info className="h-4 w-4" />
                                            <span>Chưa có KH. <Link to="/customers" className="underline font-medium">Import tại đây</Link></span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <FileUploadZone
                                        onFileUpload={handleCustomerFileUpload}
                                        uploadedFile={customerFile}
                                        isLoading={isLoadingCustomer}
                                        label=""
                                        description={`File Excel (.xlsx) - sheet "${settings.excelConfig.customerSheetName}"`}
                                    />
                                    {customerFile && customers.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-green-600">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            <span>{customers.length} khách hàng đã được tải</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Product file upload - always upload */}
                        <div className="space-y-2">
                            <FileUploadZone
                                onFileUpload={handleProductFileUpload}
                                uploadedFile={productFile}
                                isLoading={isLoadingProduct}
                                label="File Sản Phẩm"
                                description="File Excel (.xlsx) - cần có cột ID, Tên hàng, Số lượng, Giá"
                            />
                            {productFile && products.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                        <FileSpreadsheet className="h-4 w-4" />
                                        <span>{products.length} sản phẩm đã được tải</span>
                                    </div>
                                    {inventoryCheckResult && (() => {
                                        const { totalProducts, insufficientCount, outOfStockCount, allSufficient: allOk } = inventoryCheckResult;
                                        const problemCount = insufficientCount + outOfStockCount;
                                        return (
                                            <div className={`flex items-center justify-between p-2.5 rounded-lg text-sm ${allOk ? 'bg-green-50' : 'bg-yellow-50'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium">{totalProducts} SP</span>
                                                    <span className="text-green-600">Đủ: {totalProducts - problemCount}</span>
                                                    {insufficientCount > 0 && <span className="text-yellow-600">Thiếu: {insufficientCount}</span>}
                                                    {outOfStockCount > 0 && <span className="text-red-600">Hết: {outOfStockCount}</span>}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setInventoryDialogMode('preview');
                                                        setShowInventoryDialog(true);
                                                    }}
                                                >
                                                    Xem chi tiết
                                                </Button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Configuration Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            2. Cấu Hình & Tạo Đơn
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                    <p>Chọn khoảng ngày để phân bổ đơn hàng. Đơn sẽ được tạo ở trạng thái "Nháp", bạn review rồi duyệt để xử lý.</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                        <CardDescription>Thiết lập thời gian và tạo đơn nháp</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Từ ngày</Label>
                                    <DatePicker
                                        date={scheduleConfig.startDate}
                                        fromDate={new Date()}
                                        onDateChange={(date) => {
                                            if (date) {
                                                const updated = { ...scheduleConfig, startDate: date };
                                                if (date > scheduleConfig.endDate) {
                                                    updated.endDate = date;
                                                }
                                                setScheduleConfig(updated);
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Đến ngày</Label>
                                    <DatePicker
                                        date={scheduleConfig.endDate}
                                        fromDate={scheduleConfig.startDate}
                                        onDateChange={(date) => {
                                            date && setScheduleConfig({ ...scheduleConfig, endDate: date });
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {canCreate && (
                            <Button
                                className="w-full"
                                size="lg"
                                onClick={handleCreateOrders}
                                disabled={isGenerating || isCreatingOrders || isLoadingCustomer || (customers.length === 0 && !(customerSource === 'db' && dbCustomerCount && dbCustomerCount > 0)) || products.length === 0}
                            >
                                {(isGenerating || isCreatingOrders) ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Đang tạo đơn...
                                    </>
                                ) : (
                                    <>
                                        <Database className="mr-2 h-4 w-4" />
                                        Tạo Đơn Nháp
                                    </>
                                )}
                            </Button>
                        )}

                        {(isCreatingOrders || isGenerating) && creationSteps.length > 0 && (
                            <OrderCreationProgress
                                steps={creationSteps}
                                subProgress={progress.total > 0 ? { current: progress.current, total: progress.total } : undefined}
                            />
                        )}

                        {lastCreatedBatchId && !isCreatingOrders && !isGenerating && (
                            <div className="p-4 bg-green-50 rounded-lg space-y-3">
                                <div className="text-sm text-green-700 font-medium">
                                    Tạo đơn thành công!
                                </div>
                                <Link to="/batches">
                                    <Button variant="outline" size="sm" className="w-full">
                                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                        Xem & quản lý batch trong Quản Lý Batch
                                    </Button>
                                </Link>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>

            {/* Inventory Check Dialog */}
            <InventoryCheckDialog
                open={showInventoryDialog}
                mode={inventoryDialogMode}
                result={inventoryCheckResult}
                onContinueWithExcel={async () => {
                    setUseActualInventory(false);
                    setShowInventoryDialog(false);
                    toast.info('Đã chọn: Sử dụng số lượng từ file Excel');
                    await handleSupabaseExport();
                }}
                onUseActualInventory={async () => {
                    setUseActualInventory(true);
                    setShowInventoryDialog(false);
                    toast.info('Đã chọn: Sử dụng tồn kho thực tế từ NhanhVN');
                    await handleSupabaseExport();
                }}
                onCancel={() => {
                    setShowInventoryDialog(false);
                    if (inventoryDialogMode === 'action') {
                        setUseActualInventory(false);
                        setIsCreatingOrders(false);
                        setCreationSteps([]);
                    }
                }}
            />

        </div>
    );
};

export default Index;
