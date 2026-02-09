import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  OrderValueBucket,
  DayOfWeekStats,
  HourlySuccessRate,
  TimeHeatmapCell,
} from '@/types/batchAnalytics';

interface DistributionChartsProps {
  orderValueDist: OrderValueBucket[];
  dayOfWeekStats: DayOfWeekStats[];
  hourlySuccess: HourlySuccessRate[];
  heatmap: TimeHeatmapCell[];
}

const VN_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getHeatmapColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return '#f0fdf4';
  const intensity = count / maxCount;
  if (intensity > 0.75) return '#15803d';
  if (intensity > 0.5) return '#22c55e';
  if (intensity > 0.25) return '#86efac';
  return '#bbf7d0';
}

const DistributionCharts: React.FC<DistributionChartsProps> = ({
  orderValueDist,
  dayOfWeekStats,
  hourlySuccess,
  heatmap,
}) => {
  // Calculate heatmap bounds
  const { hours, maxCount } = useMemo(() => {
    const cellsWithOrders = heatmap.filter((c) => c.count > 0);
    if (cellsWithOrders.length === 0) {
      return { hours: [] as number[], maxCount: 0 };
    }
    const minHour = Math.min(...cellsWithOrders.map((c) => c.hour));
    const maxHour = Math.max(...cellsWithOrders.map((c) => c.hour));
    const hours: number[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      hours.push(h);
    }
    const maxCount = Math.max(...cellsWithOrders.map((c) => c.count));
    return { hours, maxCount };
  }, [heatmap]);

  // Build heatmap lookup
  const heatmapLookup = useMemo(() => {
    const map = new Map<string, number>();
    heatmap.forEach((c) => map.set(`${c.day}-${c.hour}`, c.count));
    return map;
  }, [heatmap]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Order Value Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phân bố giá trị đơn hàng</CardTitle>
        </CardHeader>
        <CardContent className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orderValueDist} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" angle={-45} textAnchor="end" fontSize={11} interval={0} height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Số đơn" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. Orders by Day of Week */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đơn hàng theo thứ</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dayOfWeekStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Tỷ lệ TC') return `${value.toFixed(1)}%`;
                  return value;
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="totalOrders"
                name="Tổng đơn"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="completedOrders"
                name="Hoàn thành"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="successRate"
                name="Tỷ lệ TC"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Success Rate by Hour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tỷ lệ thành công theo giờ</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlySuccess}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickFormatter={(v) => `${v}h`}
              />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                labelFormatter={(v) => `${v}h`}
                formatter={(value: number, name: string) => {
                  if (name === 'Tỷ lệ TC') return `${value.toFixed(1)}%`;
                  return value;
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="totalOrders"
                name="Tổng đơn"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="successRate"
                name="Tỷ lệ TC"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 4. Time Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heatmap thời gian đặt hàng</CardTitle>
        </CardHeader>
        <CardContent>
          {hours.length > 0 ? (
            <div className="overflow-x-auto">
              <div
                className="inline-grid gap-1"
                style={{
                  gridTemplateColumns: `auto repeat(${hours.length}, minmax(28px, 1fr))`,
                }}
              >
                {/* Header row: hour labels */}
                <div className="text-xs text-muted-foreground" />
                {hours.map((h) => (
                  <div
                    key={`h-${h}`}
                    className="text-xs text-center text-muted-foreground"
                  >
                    {h}h
                  </div>
                ))}

                {/* Data rows: one per day */}
                {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => (
                  <React.Fragment key={`day-${dayIndex}`}>
                    <div className="text-xs text-muted-foreground pr-2 flex items-center">
                      {VN_DAYS[dayIndex]}
                    </div>
                    {hours.map((h) => {
                      const count = heatmapLookup.get(`${dayIndex}-${h}`) || 0;
                      return (
                        <div
                          key={`${dayIndex}-${h}`}
                          className="w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-medium cursor-default"
                          style={{
                            backgroundColor: getHeatmapColor(count, maxCount),
                            color: count > maxCount * 0.5 ? '#fff' : '#374151',
                          }}
                          title={`${VN_DAYS[dayIndex]} ${h}h: ${count} đơn`}
                        >
                          {count > 0 ? count : ''}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <span>Ít</span>
                <div className="flex gap-0.5">
                  {['#f0fdf4', '#bbf7d0', '#86efac', '#22c55e', '#15803d'].map(
                    (color) => (
                      <div
                        key={color}
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>
                <span>Nhiều</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              Không có dữ liệu heatmap
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributionCharts;
