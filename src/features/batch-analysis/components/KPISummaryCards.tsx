import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Clock,
  Package,
  DollarSign,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import type { BatchKPIs } from '@/types/batchAnalytics';

interface KPISummaryCardsProps {
  kpis: BatchKPIs;
}

function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

function getSuccessRateColor(rate: number): string {
  if (rate > 80) return 'text-green-600';
  if (rate > 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getSuccessRateBgColor(rate: number): string {
  if (rate > 80) return 'bg-green-50';
  if (rate > 50) return 'bg-yellow-50';
  return 'bg-red-50';
}

const statusLabels: Record<string, { label: string; className: string }> = {
  completed: { label: 'HT', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Chờ', className: 'bg-yellow-100 text-yellow-700' },
  failed: { label: 'Lỗi', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Hủy', className: 'bg-gray-100 text-gray-700' },
  draft: { label: 'Nháp', className: 'bg-purple-100 text-purple-700' },
};

const KPISummaryCards: React.FC<KPISummaryCardsProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 1. Tổng đơn */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tổng đơn</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalOrders}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(kpis.statusBreakdown).map(([status, count]) => {
              const config = statusLabels[status] || {
                label: status,
                className: 'bg-gray-100 text-gray-700',
              };
              return (
                <Badge
                  key={status}
                  variant="outline"
                  className={`text-xs ${config.className} border-0`}
                >
                  {config.label}: {count}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Tỷ lệ thành công */}
      <Card className={getSuccessRateBgColor(kpis.successRate)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tỷ lệ thành công</CardTitle>
          <CheckCircle2
            className={`h-4 w-4 ${getSuccessRateColor(kpis.successRate)}`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${getSuccessRateColor(kpis.successRate)}`}
          >
            {kpis.successRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.statusBreakdown['completed'] || 0} /{' '}
            {kpis.totalOrders} đơn hoàn thành
          </p>
        </CardContent>
      </Card>

      {/* 3. Doanh thu (revenue) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Doanh thu</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatVND(kpis.completedRevenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            / {formatVND(kpis.totalRevenue)} tổng dự kiến
          </p>
        </CardContent>
      </Card>

      {/* 4. Giá trị TB/đơn */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Giá trị TB/đơn</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatVND(kpis.avgOrderValue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Trung bình mỗi đơn hoàn thành
          </p>
        </CardContent>
      </Card>

      {/* 5. Thời gian xử lý TB */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Thời gian xử lý TB
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {kpis.avgProcessingTime.toFixed(1)} phut
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Từ lúc lên lịch đến hoàn thành
          </p>
        </CardContent>
      </Card>

      {/* 6. SP TB/đơn */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">SP TB/đơn</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {kpis.avgProductsPerOrder.toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sản phẩm trung bình mỗi đơn
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default KPISummaryCards;
