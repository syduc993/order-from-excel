import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SupabaseService } from '@/services/supabase';
import { env } from '@/config/env';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/DatePicker';
import { toast } from 'sonner';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    ComposedChart
} from 'recharts';
import { Loader2, ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { convertHourToVietnam, normalizeDate, formatDateForDisplay } from '@/utils/dateUtils';

const Dashboard = () => {
    const navigate = useNavigate();
    const [batchId, setBatchId] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    const handleStatusChange = (status: string, checked: boolean | 'indeterminate') => {
        if (checked === true) {
            setSelectedStatuses(prev => [...prev, status]);
        } else {
            setSelectedStatuses(prev => prev.filter(s => s !== status));
        }
    };

    // Supabase configuration
    const supabaseConfig = (() => {
        if (env.supabase.url && env.supabase.anonKey) {
            return { url: env.supabase.url, key: env.supabase.anonKey };
        }
        return null;
    })();

    const supabaseService = useMemo(() => {
        return supabaseConfig ? new SupabaseService(supabaseConfig) : null;
    }, [supabaseConfig]);

    const { data: aggregatedStats, isLoading, refetch } = useQuery({
        queryKey: ['dashboardStats', batchId, startDate, endDate, selectedStatuses],
        queryFn: async () => {
            if (!supabaseService) return null;
            return await supabaseService.getDashboardStats({
                batchId: batchId || undefined,
                startDate,
                endDate,
                statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
            });
        },
        enabled: !!supabaseService,
    });

    const handleSearch = () => {
        refetch();
    };

    const statusBreakdown = aggregatedStats?.statusBreakdown || [];

    // Convert hour from UTC to Vietnam timezone (+7 hours)
    // Database returns hour in UTC (0-23), we need to convert to Vietnam time (0-23)


    const histogramCount = (aggregatedStats?.histogramCount || [])
        .map((item: any) => ({
            ...item,
            hour: convertHourToVietnam(item.hour)
        }))
        .sort((a: any, b: any) => a.hour - b.hour);

    const histogramAmount = (aggregatedStats?.histogramAmount || [])
        .map((item: any) => ({
            ...item,
            hour: convertHourToVietnam(item.hour)
        }))
        .sort((a: any, b: any) => a.hour - b.hour);

    const revenueByDate = aggregatedStats?.revenueByDate || [];
    const revenueByHour = (aggregatedStats?.revenueByHour || [])
        .map((item: any) => ({
            ...item,
            hour: convertHourToVietnam(item.hour)
        }))
        .sort((a: any, b: any) => a.hour - b.hour);
    const productQuantityByDate = aggregatedStats?.productQuantityByDate || [];

    // Calculate daily stats for the table
    const dailyStats = useMemo(() => {
        // Helper function to normalize date format to YYYY-MM-DD
        // Database should return dates in YYYY-MM-DD format, so we just need to ensure consistency


        // Normalize dates and build maps
        const revenueMap = new Map<string, any>();
        revenueByDate.forEach((item: any) => {
            const normalizedDate = normalizeDate(item.date);
            if (normalizedDate) {
                // Debug: log if date seems wrong (year < 2000)
                if (normalizedDate.startsWith('19')) {
                    console.warn('⚠️ Suspicious date from revenueByDate:', item.date, '-> normalized:', normalizedDate);
                }
                revenueMap.set(normalizedDate, item);
            }
        });

        const quantityMap = new Map<string, any>();
        productQuantityByDate.forEach((item: any) => {
            const normalizedDate = normalizeDate(item.date);
            if (normalizedDate) {
                // Debug: log if date seems wrong (year < 2000)
                if (normalizedDate.startsWith('19')) {
                    console.warn('⚠️ Suspicious date from productQuantityByDate:', item.date, '-> normalized:', normalizedDate);
                }
                quantityMap.set(normalizedDate, item);
            }
        });

        // Get all unique dates (already normalized) and sort
        const allDates = Array.from(new Set([...revenueMap.keys(), ...quantityMap.keys()]))
            .filter(d => d) // Remove empty strings
            .sort();

        return allDates.map(date => {
            const rev = revenueMap.get(date);
            const qty = quantityMap.get(date);
            return {
                date,
                revenue: rev?.total || 0,
                quantity: qty?.total_quantity || 0
            };
        });
    }, [revenueByDate, productQuantityByDate]);

    const totalStats = useMemo(() => {
        return dailyStats.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            quantity: acc.quantity + curr.quantity
        }), { revenue: 0, quantity: 0 });
    }, [dailyStats]);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate('/')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-3xl font-bold">Dashboard Thống Kê</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Bộ Lọc
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Batch ID (Tùy chọn)</Label>
                            <Input
                                placeholder="Nhập Batch ID..."
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Từ Ngày</Label>
                            <DatePicker
                                date={startDate}
                                onDateChange={setStartDate}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Đến Ngày</Label>
                            <DatePicker
                                date={endDate}
                                onDateChange={setEndDate}
                            />
                        </div>
                        <div className="space-y-2 col-span-full">
                            <Label>Trạng Thái</Label>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="completed"
                                        checked={selectedStatuses.includes('completed')}
                                        onCheckedChange={(checked) => handleStatusChange('completed', checked)}
                                    />
                                    <Label htmlFor="completed" className="text-sm font-normal cursor-pointer">Completed</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pending"
                                        checked={selectedStatuses.includes('pending')}
                                        onCheckedChange={(checked) => handleStatusChange('pending', checked)}
                                    />
                                    <Label htmlFor="pending" className="text-sm font-normal cursor-pointer">Pending</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="cancelled"
                                        checked={selectedStatuses.includes('cancelled')}
                                        onCheckedChange={(checked) => handleStatusChange('cancelled', checked)}
                                    />
                                    <Label htmlFor="cancelled" className="text-sm font-normal cursor-pointer">Cancelled</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="failed"
                                        checked={selectedStatuses.includes('failed')}
                                        onCheckedChange={(checked) => handleStatusChange('failed', checked)}
                                    />
                                    <Label htmlFor="failed" className="text-sm font-normal cursor-pointer">Failed</Label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Áp Dụng Bộ Lọc'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {aggregatedStats && (statusBreakdown.length > 0 || histogramCount.length > 0 || revenueByDate.length > 0) ? (
                <div className="space-y-6">
                    {/* Row 1: Status Breakdown + Revenue by Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status Breakdown Pie Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Tổng Quan Trạng Thái</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusBreakdown}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, value, percent }) =>
                                                `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                                            }
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {statusBreakdown.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Revenue by Date Composed Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Doanh Số Theo Ngày</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={revenueByDate}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                                        <Tooltip formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value as number)} />
                                        <Legend />
                                        <Bar dataKey="total" name="Tổng dự kiến" fill="#f97316" barSize={20} />
                                        <Line type="monotone" dataKey="completed" name="Đã hoàn thành" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 2: Histogram Count + Product Quantity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Phân Bố Số Lượng Đơn Theo Giờ</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={histogramCount}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="hour"
                                            tickFormatter={(value) => `${value}h`}
                                        />
                                        <YAxis />
                                        <Tooltip labelFormatter={(value) => `Giờ ${value}h`} />
                                        <Legend />
                                        <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" />
                                        <Bar dataKey="pending" name="Pending" stackId="a" fill="#eab308" />
                                        <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="#6b7280" />
                                        <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Phân Bố Số Lượng Sản Phẩm Theo Ngày</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={productQuantityByDate}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="completed_quantity" name="Completed" stackId="a" fill="#22c55e" />
                                        <Bar dataKey="pending_quantity" name="Pending" stackId="a" fill="#eab308" />
                                        <Bar dataKey="cancelled_quantity" name="Cancelled" stackId="a" fill="#6b7280" />
                                        <Bar dataKey="failed_quantity" name="Failed" stackId="a" fill="#ef4444" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 3: Histogram Amount + Revenue by Hour */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Phân Bố Thành Tiền Theo Giờ</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={histogramAmount}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="hour"
                                            tickFormatter={(value) => `${value}h`}
                                        />
                                        <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                                        <Tooltip
                                            labelFormatter={(value) => `Giờ ${value}h`}
                                            formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value as number)}
                                        />
                                        <Legend />
                                        <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" />
                                        <Bar dataKey="pending" name="Pending" stackId="a" fill="#eab308" />
                                        <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="#6b7280" />
                                        <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Doanh Số Theo Khung Giờ</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueByHour}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="hour"
                                            tickFormatter={(value) => `${value}h`}
                                        />
                                        <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                                        <Tooltip
                                            labelFormatter={(value) => `Giờ ${value}h`}
                                            formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value as number)}
                                        />
                                        <Legend />
                                        <Area type="monotone" dataKey="total" name="Tổng dự kiến" stackId="1" stroke="#f97316" fill="#f97316" />
                                        <Area type="monotone" dataKey="completed" name="Đã hoàn thành" stackId="2" stroke="#3b82f6" fill="#3b82f6" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 4: Daily Statistics Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Chi Tiết Thống Kê Theo Ngày</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ngày</TableHead>
                                        <TableHead className="text-right">Doanh Số</TableHead>
                                        <TableHead className="text-right">Số Lượng Sản Phẩm</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dailyStats.map((stat) => {
                                        // Format date for display (YYYY-MM-DD -> DD/MM/YYYY)


                                        return (
                                            <TableRow key={stat.date}>
                                                <TableCell className="font-medium">{formatDateForDisplay(stat.date)}</TableCell>
                                                <TableCell className="text-right">
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stat.revenue)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {new Intl.NumberFormat('vi-VN').format(stat.quantity)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell className="font-bold">Tổng Cộng</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalStats.revenue)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {new Intl.NumberFormat('vi-VN').format(totalStats.quantity)}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500">
                    Chưa có dữ liệu thống kê. Vui lòng chọn bộ lọc và nhấn "Áp Dụng".
                </div>
            )}
        </div>
    );
};

export default Dashboard;
