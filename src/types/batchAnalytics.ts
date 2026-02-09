export interface BatchKPIs {
  totalOrders: number;
  successRate: number;
  completedRevenue: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgProductsPerOrder: number;
  avgProcessingTime: number; // minutes
  statusBreakdown: Record<string, number>;
}

export interface ProductAnalytics {
  productId: number;
  productName?: string;
  totalQuantity: number;
  completedQuantity: number;
  failedQuantity: number;
  revenue: number;
}

export interface CustomerAnalytics {
  customerId: number;
  customerName: string;
  orderCount: number;
  totalRevenue: number;
}

export interface OrderValueBucket {
  range: string;
  count: number;
  min: number;
  max: number;
}

export interface DayOfWeekStats {
  day: string;
  dayIndex: number;
  totalOrders: number;
  completedOrders: number;
  successRate: number;
}

export interface HourlySuccessRate {
  hour: number;
  totalOrders: number;
  completedOrders: number;
  successRate: number;
}

export interface TimeHeatmapCell {
  day: number; // 0=Sun, 1=Mon, ..., 6=Sat
  hour: number; // 0-23
  count: number;
}

export interface FailureGroup {
  errorMessage: string;
  count: number;
  orderIds: number[];
}
