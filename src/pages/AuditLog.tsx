import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/DatePicker';
import { Loader2, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { TablePagination } from '@/components/TablePagination';
import { toast } from 'sonner';
import { getSupabaseService } from '@/services/supabase';

const actionLabels: Record<string, string> = {
    create_batch: 'Tạo batch',
    approve_drafts: 'Duyệt đơn nháp',
    cancel_order: 'Hủy đơn',
    retry_order: 'Thử lại đơn',
    adjust_orders: 'Điều chỉnh đơn',
    update_settings: 'Cập nhật cài đặt',
    create_manual_order: 'Tạo đơn thủ công',
};

const AuditLog = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Filters
    const [filterEmail, setFilterEmail] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
    const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();

    const [pageSize, setPageSize] = useState(10);

    const loadLogs = async (p: number = 1, size: number = pageSize) => {
        const service = getSupabaseService();
        if (!service) return;

        setIsLoading(true);
        try {
            const result = await service.getAuditLogs({
                userEmail: filterEmail || undefined,
                action: filterAction || undefined,
                startDate: filterDateFrom,
                endDate: filterDateTo,
                page: p,
                pageSize: size,
            });
            setLogs(result.data);
            setTotalCount(result.count);
            setPage(p);
        } catch (error) {
            toast.error(`Lỗi tải nhật ký: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="container mx-auto p-6 max-w-6xl space-y-6">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Nhật Ký Hoạt Động</h1>
                <p className="text-muted-foreground">Theo dõi mọi thao tác trong hệ thống</p>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Email</label>
                            <Input
                                placeholder="Lọc theo email"
                                value={filterEmail}
                                onChange={(e) => setFilterEmail(e.target.value)}
                                className="w-48"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Hành động</label>
                            <Input
                                placeholder="Lọc theo action"
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Từ ngày</label>
                            <DatePicker date={filterDateFrom} onDateChange={(d) => setFilterDateFrom(d || undefined)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Đến ngày</label>
                            <DatePicker date={filterDateTo} onDateChange={(d) => setFilterDateTo(d || undefined)} />
                        </div>
                        <Button onClick={() => loadLogs(1)}>
                            <Filter className="mr-1 h-4 w-4" />
                            Tải nhật ký
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Log table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Nhật ký ({totalCount} bản ghi)</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-center text-muted-foreground p-8">
                            {totalCount === 0 && !isLoading ? 'Bấm "Tải nhật ký" để xem dữ liệu' : 'Không có dữ liệu'}
                        </p>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30px]"></TableHead>
                                            <TableHead>Thời gian</TableHead>
                                            <TableHead>Người thực hiện</TableHead>
                                            <TableHead>Hành động</TableHead>
                                            <TableHead>Đối tượng</TableHead>
                                            <TableHead>ID</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <React.Fragment key={log.id}>
                                                <TableRow
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                                >
                                                    <TableCell>
                                                        {log.details ? (
                                                            expandedId === log.id
                                                                ? <ChevronDown className="h-4 w-4" />
                                                                : <ChevronRight className="h-4 w-4" />
                                                        ) : null}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {new Date(log.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{log.user_email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {actionLabels[log.action] || log.action}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{log.entity_type || '-'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{log.entity_id || '-'}</TableCell>
                                                </TableRow>
                                                {expandedId === log.id && log.details && (
                                                    <TableRow key={`${log.id}-detail`}>
                                                        <TableCell colSpan={6} className="bg-muted/30">
                                                            <pre className="text-xs overflow-auto max-h-40 p-2">
                                                                {JSON.stringify(log.details, null, 2)}
                                                            </pre>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <TablePagination
                                page={page}
                                pageSize={pageSize}
                                totalItems={totalCount}
                                onPageChange={(p) => loadLogs(p)}
                                onPageSizeChange={(size) => { setPageSize(size); loadLogs(1, size); }}
                                itemLabel="bản ghi"
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AuditLog;
