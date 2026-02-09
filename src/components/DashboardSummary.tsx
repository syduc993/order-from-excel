import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, CheckCircle2, DollarSign, Package } from 'lucide-react';

interface DashboardSummaryProps {
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalQuantity: number;
}

function formatVND(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ₫`;
  }
  return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
}

export function DashboardSummary({
  totalOrders,
  completedOrders,
  totalRevenue,
  totalQuantity,
}: DashboardSummaryProps) {
  const successRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  const cards = [
    {
      label: 'Tổng Đơn Hàng',
      value: totalOrders.toLocaleString('vi-VN'),
      icon: BarChart3,
      color: 'text-blue-600',
    },
    {
      label: 'Tỷ Lệ Thành Công',
      value: `${successRate.toFixed(1)}%`,
      sub: `${completedOrders} / ${totalOrders}`,
      icon: CheckCircle2,
      color: successRate > 80 ? 'text-green-600' : successRate > 50 ? 'text-yellow-600' : 'text-red-600',
    },
    {
      label: 'Tổng Doanh Thu',
      value: formatVND(totalRevenue),
      icon: DollarSign,
      color: 'text-emerald-600',
    },
    {
      label: 'Tổng Sản Phẩm',
      value: totalQuantity.toLocaleString('vi-VN'),
      icon: Package,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <card.icon className={`h-8 w-8 ${card.color} shrink-0`} />
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold">{card.value}</p>
              {'sub' in card && card.sub && (
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
