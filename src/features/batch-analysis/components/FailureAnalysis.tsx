import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { FailureGroup } from '@/types/batchAnalytics';
import { TablePagination } from '@/components/TablePagination';

interface FailureAnalysisProps {
  failures: FailureGroup[];
  orders: any[];
}

const FailureAnalysis: React.FC<FailureAnalysisProps> = ({
  failures,
  orders,
}) => {
  const [errorPage, setErrorPage] = useState(1);
  const [errorPageSize, setErrorPageSize] = useState(10);
  const [idsPage, setIdsPage] = useState(1);
  const [idsPageSize, setIdsPageSize] = useState(100);

  // Calculate failure by hour
  const failureByHour = useMemo(() => {
    const hourMap = new Map<number, number>();
    const failedOrders = orders.filter((o) => o.status === 'failed');

    failedOrders.forEach((o) => {
      if (!o.scheduled_time) return;
      const d = new Date(o.scheduled_time);
      const utcHour = d.getUTCHours();
      const vnHour = (utcHour + 7) % 24;
      hourMap.set(vnHour, (hourMap.get(vnHour) || 0) + 1);
    });

    const result: { hour: number; count: number }[] = [];
    hourMap.forEach((count, hour) => {
      result.push({ hour, count });
    });

    return result.sort((a, b) => a.hour - b.hour);
  }, [orders]);

  // Collect all failed order IDs
  const allFailedIds = useMemo(() => {
    const ids = new Set<number>();
    failures.forEach((f) => f.orderIds.forEach((id) => ids.add(id)));
    return Array.from(ids).sort((a, b) => a - b);
  }, [failures]);

  // Pagination for error table
  const paginatedFailures = useMemo(() => {
    const start = (errorPage - 1) * errorPageSize;
    return failures.slice(start, start + errorPageSize);
  }, [failures, errorPage, errorPageSize]);

  // Pagination for failed IDs
  const paginatedIds = useMemo(() => {
    const start = (idsPage - 1) * idsPageSize;
    return allFailedIds.slice(start, start + idsPageSize);
  }, [allFailedIds, idsPage, idsPageSize]);

  if (failures.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-red-600">Phân tích lỗi</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Error Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tóm tắt lỗi ({failures.length} loại)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nội dung lỗi</TableHead>
                  <TableHead className="text-right w-[80px]">Số lượng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFailures.map((f, i) => (
                  <TableRow key={(errorPage - 1) * errorPageSize + i}>
                    <TableCell className="text-sm max-w-[300px] truncate">
                      {f.errorMessage}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {f.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              page={errorPage}
              pageSize={errorPageSize}
              totalItems={failures.length}
              onPageChange={setErrorPage}
              onPageSizeChange={(size) => { setErrorPageSize(size); setErrorPage(1); }}
              itemLabel="loại lỗi"
            />
          </CardContent>
        </Card>

        {/* Failure by Hour Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lỗi theo khung giờ</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {failureByHour.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={failureByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(v) => `${v}h`} />
                  <Bar
                    dataKey="count"
                    name="Đơn lỗi"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Không có dữ liệu thời gian lỗi
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Failed Order IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Danh sách đơn lỗi ({allFailedIds.length} đơn)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {paginatedIds.map((id) => (
              <span
                key={id}
                className="inline-block px-2 py-0.5 text-xs font-mono bg-red-50 text-red-700 rounded border border-red-200"
              >
                #{id}
              </span>
            ))}
          </div>

          <TablePagination
            page={idsPage}
            pageSize={idsPageSize}
            totalItems={allFailedIds.length}
            onPageChange={setIdsPage}
            onPageSizeChange={(size) => { setIdsPageSize(size); setIdsPage(1); }}
            itemLabel="đơn lỗi"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default FailureAnalysis;
