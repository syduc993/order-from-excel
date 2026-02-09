import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSupabaseService } from '@/services/supabase';
import {
  calculateKPIs,
  calculateProductAnalytics,
  calculateCustomerAnalytics,
  calculateOrderValueDistribution,
  calculateDayOfWeekStats,
  calculateSuccessRateByHour,
  calculateTimeHeatmap,
  calculateFailureAnalysis,
} from '@/utils/batchStatsUtils';
import KPISummaryCards from '@/features/batch-analysis/components/KPISummaryCards';
import DistributionCharts from '@/features/batch-analysis/components/DistributionCharts';
import ProductCustomerAnalytics from '@/features/batch-analysis/components/ProductCustomerAnalytics';
import FailureAnalysis from '@/features/batch-analysis/components/FailureAnalysis';
import { DraftApprovalBar } from '@/features/order-generation/components/DraftApprovalBar';
import { useOrderActions } from '@/features/order-generation/hooks/useOrderActions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Download, Trash2, Loader2 } from 'lucide-react';
import { exportOrdersToExcel } from '@/utils/excelExport';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BatchAnalysis: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<any[]>([]);
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const supabaseService = getSupabaseService();

  const fetchData = useCallback(async () => {
    if (!batchId || !supabaseService) {
      setLoading(false);
      setError('Thiếu batch ID hoặc cấu hình Supabase.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [allOrders, batchData] = await Promise.all([
        supabaseService.getAllOrders(batchId),
        supabaseService.getBatch(batchId),
      ]);
      setOrders(allOrders);
      setBatch(batchData);
    } catch (err: any) {
      console.error('Failed to load batch analysis data:', err);
      setError(err.message || 'Không thể tải dữ liệu phân tích.');
    } finally {
      setLoading(false);
    }
  }, [batchId, supabaseService]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { isLoading: isApproving, approveAllDrafts, approveSelected, deleteOrders } = useOrderActions(fetchData);

  const draftCount = useMemo(() => orders.filter(o => o.status === 'draft').length, [orders]);

  // Calculate all analytics from orders
  const kpis = useMemo(() => calculateKPIs(orders), [orders]);
  const products = useMemo(() => calculateProductAnalytics(orders), [orders]);
  const customers = useMemo(
    () => calculateCustomerAnalytics(orders),
    [orders]
  );
  const orderValueDist = useMemo(
    () => calculateOrderValueDistribution(orders),
    [orders]
  );
  const dayOfWeekStats = useMemo(
    () => calculateDayOfWeekStats(orders),
    [orders]
  );
  const hourlySuccess = useMemo(
    () => calculateSuccessRateByHour(orders),
    [orders]
  );
  const heatmap = useMemo(() => calculateTimeHeatmap(orders), [orders]);
  const failures = useMemo(
    () => calculateFailureAnalysis(orders),
    [orders]
  );

  const handleDelete = async () => {
    if (!batchId || !supabaseService) return;
    setIsDeleting(true);
    try {
      const result = await supabaseService.deleteBatch(batchId);
      toast.success(`Đã xóa batch và ${result.deletedOrders} đơn hàng`);
      navigate('/batches');
    } catch (err: any) {
      toast.error(`Lỗi xóa batch: ${err.message}`);
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleExport = async () => {
    if (!batchId || orders.length === 0) return;
    try {
      await exportOrdersToExcel(orders, batchId);
      toast.success('Đã xuất file Excel thành công');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Xuất file thất bại');
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[350px]" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Phân tích Batch</h1>
            <p className="text-sm text-muted-foreground">
              {batchId}
              {batch && (
                <>
                  {' '}
                  | {batch.start_date} - {batch.end_date} |{' '}
                  {orders.length} đơn
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={orders.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Xuất Excel
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa batch
          </Button>
        </div>
      </div>

      {/* Draft Approval Bar */}
      {batchId && (
        <DraftApprovalBar
          draftCount={draftCount}
          selectedIds={[]}
          batchId={batchId}
          isLoading={isApproving}
          onApproveAll={approveAllDrafts}
          onApproveSelected={approveSelected}
          onDeleteSelected={deleteOrders}
        />
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Không có đơn hàng trong batch này.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Summary */}
          <KPISummaryCards kpis={kpis} />

          {/* Distribution Charts */}
          <DistributionCharts
            orderValueDist={orderValueDist}
            dayOfWeekStats={dayOfWeekStats}
            hourlySuccess={hourlySuccess}
            heatmap={heatmap}
          />

          {/* Product & Customer Analytics */}
          <ProductCustomerAnalytics
            products={products}
            customers={customers}
          />

          {/* Failure Analysis (conditional) */}
          <FailureAnalysis failures={failures} orders={orders} />
        </>
      )}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa batch</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa vĩnh viễn batch này và tất cả {orders.length} đơn hàng.
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                'Xóa batch'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BatchAnalysis;
