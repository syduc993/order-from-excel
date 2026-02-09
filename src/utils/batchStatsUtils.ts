import type {
  BatchKPIs,
  ProductAnalytics,
  CustomerAnalytics,
  OrderValueBucket,
  DayOfWeekStats,
  HourlySuccessRate,
  TimeHeatmapCell,
  FailureGroup,
} from '@/types/batchAnalytics';

const VN_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getVietnamHour(dateStr: string): number {
  const d = new Date(dateStr);
  const utcHour = d.getUTCHours();
  return (utcHour + 7) % 24;
}

function getVietnamDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getTime() + 7 * 60 * 60 * 1000);
}

export function calculateKPIs(orders: any[]): BatchKPIs {
  const statusBreakdown: Record<string, number> = {};
  let completedRevenue = 0;
  let totalRevenue = 0;
  let totalProducts = 0;
  let completedCount = 0;
  let processingTimeSum = 0;
  let processingTimeCount = 0;

  orders.forEach((o) => {
    statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
    totalRevenue += o.total_amount || 0;
    totalProducts += o.order_data?.products?.length || 0;

    if (o.status === 'completed') {
      completedCount++;
      completedRevenue += o.total_amount || 0;
      if (o.updated_at && o.scheduled_time) {
        const diff = new Date(o.updated_at).getTime() - new Date(o.scheduled_time).getTime();
        if (diff > 0) {
          processingTimeSum += diff / 60000;
          processingTimeCount++;
        }
      }
    }
  });

  return {
    totalOrders: orders.length,
    successRate: orders.length > 0 ? (completedCount / orders.length) * 100 : 0,
    completedRevenue,
    totalRevenue,
    avgOrderValue: completedCount > 0 ? completedRevenue / completedCount : 0,
    avgProductsPerOrder: orders.length > 0 ? totalProducts / orders.length : 0,
    avgProcessingTime: processingTimeCount > 0 ? processingTimeSum / processingTimeCount : 0,
    statusBreakdown,
  };
}

export function calculateProductAnalytics(orders: any[]): ProductAnalytics[] {
  const map = new Map<number, ProductAnalytics>();

  orders.forEach((o) => {
    const products = o.order_data?.products || [];
    products.forEach((p: any) => {
      const existing = map.get(p.id) || {
        productId: p.id,
        productName: p.name || undefined,
        totalQuantity: 0,
        completedQuantity: 0,
        failedQuantity: 0,
        revenue: 0,
      };
      if (!existing.productName && p.name) {
        existing.productName = p.name;
      }
      existing.totalQuantity += p.quantity || 0;
      if (o.status === 'completed') {
        existing.completedQuantity += p.quantity || 0;
        existing.revenue += (p.quantity || 0) * (p.price || 0);
      } else if (o.status === 'failed') {
        existing.failedQuantity += p.quantity || 0;
      }
      map.set(p.id, existing);
    });
  });

  return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
}

export function calculateCustomerAnalytics(orders: any[]): CustomerAnalytics[] {
  const map = new Map<number, CustomerAnalytics>();

  orders.forEach((o) => {
    const existing = map.get(o.customer_id) || {
      customerId: o.customer_id,
      customerName: o.customer_name,
      orderCount: 0,
      totalRevenue: 0,
    };
    existing.orderCount++;
    existing.totalRevenue += o.total_amount || 0;
    map.set(o.customer_id, existing);
  });

  return Array.from(map.values()).sort((a, b) => b.orderCount - a.orderCount);
}

export function calculateOrderValueDistribution(orders: any[]): OrderValueBucket[] {
  const buckets: OrderValueBucket[] = [
    { range: '0-100K', count: 0, min: 0, max: 100000 },
    { range: '100-200K', count: 0, min: 100000, max: 200000 },
    { range: '200-300K', count: 0, min: 200000, max: 300000 },
    { range: '300-400K', count: 0, min: 300000, max: 400000 },
    { range: '400-500K', count: 0, min: 400000, max: 500000 },
    { range: '500-600K', count: 0, min: 500000, max: 600000 },
    { range: '600-700K', count: 0, min: 600000, max: 700000 },
    { range: '700-800K', count: 0, min: 700000, max: 800000 },
    { range: '800-900K', count: 0, min: 800000, max: 900000 },
    { range: '900K-1M', count: 0, min: 900000, max: 1000000 },
    { range: '1M-1.1M', count: 0, min: 1000000, max: 1100000 },
    { range: '1.1-1.2M', count: 0, min: 1100000, max: 1200000 },
    { range: '1.2-1.3M', count: 0, min: 1200000, max: 1300000 },
    { range: '1.3-1.4M', count: 0, min: 1300000, max: 1400000 },
    { range: '1.4-1.5M', count: 0, min: 1400000, max: 1500000 },
    { range: '1.5-1.6M', count: 0, min: 1500000, max: 1600000 },
    { range: '1.6-1.7M', count: 0, min: 1600000, max: 1700000 },
    { range: '1.7-1.8M', count: 0, min: 1700000, max: 1800000 },
    { range: '1.8-1.9M', count: 0, min: 1800000, max: 1900000 },
    { range: '1.9-2M', count: 0, min: 1900000, max: 2000000 },
    { range: '2M+', count: 0, min: 2000000, max: Infinity },
  ];

  orders.forEach((o) => {
    const amount = o.total_amount || 0;
    for (const bucket of buckets) {
      if (amount >= bucket.min && amount < bucket.max) {
        bucket.count++;
        break;
      }
    }
  });

  return buckets;
}

export function calculateDayOfWeekStats(orders: any[]): DayOfWeekStats[] {
  const stats = VN_DAYS.map((day, i) => ({
    day,
    dayIndex: i,
    totalOrders: 0,
    completedOrders: 0,
    successRate: 0,
  }));

  orders.forEach((o) => {
    if (!o.scheduled_time) return;
    const vnDate = getVietnamDate(o.scheduled_time);
    const dayIndex = vnDate.getUTCDay();
    stats[dayIndex].totalOrders++;
    if (o.status === 'completed') stats[dayIndex].completedOrders++;
  });

  stats.forEach((s) => {
    s.successRate = s.totalOrders > 0 ? (s.completedOrders / s.totalOrders) * 100 : 0;
  });

  // Reorder: Mon-Sun
  return [...stats.slice(1), stats[0]];
}

export function calculateSuccessRateByHour(orders: any[]): HourlySuccessRate[] {
  const hours: HourlySuccessRate[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    totalOrders: 0,
    completedOrders: 0,
    successRate: 0,
  }));

  orders.forEach((o) => {
    if (!o.scheduled_time) return;
    const hour = getVietnamHour(o.scheduled_time);
    hours[hour].totalOrders++;
    if (o.status === 'completed') hours[hour].completedOrders++;
  });

  hours.forEach((h) => {
    h.successRate = h.totalOrders > 0 ? (h.completedOrders / h.totalOrders) * 100 : 0;
  });

  return hours.filter((h) => h.totalOrders > 0);
}

export function calculateTimeHeatmap(orders: any[]): TimeHeatmapCell[] {
  // 7 days × 24 hours grid - use direct indexing (day * 24 + hour) for O(1) lookup
  const grid: TimeHeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      grid.push({ day, hour, count: 0 });
    }
  }

  orders.forEach((o) => {
    if (!o.scheduled_time) return;
    const vnDate = getVietnamDate(o.scheduled_time);
    const day = vnDate.getUTCDay();
    const hour = getVietnamHour(o.scheduled_time);
    grid[day * 24 + hour].count++;
  });

  return grid;
}

export function calculateFailureAnalysis(orders: any[]): FailureGroup[] {
  const map = new Map<string, FailureGroup>();

  orders
    .filter((o) => o.status === 'failed')
    .forEach((o) => {
      const msg = o.error_message || 'Không rõ lỗi';
      const existing = map.get(msg) || { errorMessage: msg, count: 0, orderIds: [] };
      existing.count++;
      existing.orderIds.push(o.id);
      map.set(msg, existing);
    });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
