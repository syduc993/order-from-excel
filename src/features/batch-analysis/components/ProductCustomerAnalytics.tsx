import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/TablePagination';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  ProductAnalytics,
  CustomerAnalytics,
} from '@/types/batchAnalytics';

interface ProductCustomerAnalyticsProps {
  products: ProductAnalytics[];
  customers: CustomerAnalytics[];
}

function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}


const ProductCustomerAnalytics: React.FC<ProductCustomerAnalyticsProps> = ({
  products,
  customers,
}) => {
  const [productMetric, setProductMetric] = useState<'quantity' | 'revenue'>(
    'quantity'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sortedProducts = useMemo(() => {
    return productMetric === 'quantity'
      ? [...products].sort((a, b) => b.totalQuantity - a.totalQuantity)
      : [...products].sort((a, b) => b.revenue - a.revenue);
  }, [products, productMetric]);

  const top10Products = useMemo(() => {
    return sortedProducts.slice(0, 10);
  }, [sortedProducts]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, currentPage, pageSize]);

  const top10Customers = useMemo(() => {
    return [...customers]
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
  }, [customers]);

  const productChartData = useMemo(() => {
    return top10Products.map((p) => ({
      name: p.productName || `SP#${p.productId}`,
      value:
        productMetric === 'quantity' ? p.totalQuantity : p.revenue,
    }));
  }, [top10Products, productMetric]);

  const customerChartData = useMemo(() => {
    return top10Customers.map((c) => ({
      name: c.customerName || `KH#${c.customerId}`,
      value: c.orderCount,
    }));
  }, [top10Customers]);

  return (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 10 Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top 10 Sản phẩm</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={productMetric === 'quantity' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProductMetric('quantity')}
                >
                  Số lượng
                </Button>
                <Button
                  variant={productMetric === 'revenue' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProductMetric('revenue')}
                >
                  Doanh thu
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productChartData}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={
                    productMetric === 'revenue'
                      ? (v) => `${(v / 1000000).toFixed(1)}M`
                      : undefined
                  }
                />
                <YAxis dataKey="name" type="category" width={70} />
                <Tooltip
                  formatter={(value: number) =>
                    productMetric === 'revenue'
                      ? formatVND(value)
                      : value.toLocaleString('vi-VN')
                  }
                />
                <Bar
                  dataKey="value"
                  name={productMetric === 'quantity' ? 'Số lượng' : 'Doanh thu'}
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 10 Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={customerChartData}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name="Số đơn"
                  fill="#22c55e"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Product Summary Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Chi tiết sản phẩm ({products.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SP ID</TableHead>
                <TableHead>Tên sản phẩm</TableHead>
                <TableHead className="text-right">SL Đặt</TableHead>
                <TableHead className="text-right">SL Thành công</TableHead>
                <TableHead className="text-right">SL Lỗi</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((p) => (
                <TableRow key={p.productId}>
                  <TableCell className="font-medium">{p.productId}</TableCell>
                  <TableCell>{p.productName || '-'}</TableCell>
                  <TableCell className="text-right">
                    {p.totalQuantity.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {p.completedQuantity.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {p.failedQuantity.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(p.revenue)}
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Không có dữ liệu sản phẩm
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <TablePagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={sortedProducts.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            itemLabel="sản phẩm"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductCustomerAnalytics;
