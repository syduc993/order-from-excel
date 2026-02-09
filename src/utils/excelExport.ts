import ExcelJS from 'exceljs';
import { getStatusText } from './orderUtils';

export async function exportOrdersToExcel(orders: any[], batchId: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Đơn hàng');

    // Headers
    sheet.columns = [
        { header: '#', key: 'index', width: 8 },
        { header: 'Khách hàng', key: 'customer_name', width: 25 },
        { header: 'SĐT', key: 'customer_phone', width: 15 },
        { header: 'Sản phẩm', key: 'products', width: 40 },
        { header: 'Tổng tiền (VNĐ)', key: 'total_amount', width: 18 },
        { header: 'Thời gian dự kiến', key: 'scheduled_time', width: 22 },
        { header: 'Trạng thái', key: 'status', width: 15 },
        { header: 'Lỗi', key: 'error', width: 30 },
        { header: 'Bill ID', key: 'bill_id', width: 15 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
    };

    // Data rows
    orders.forEach(order => {
        const products = (order.order_data?.products || [])
            .map((p: any) => `${p.quantity}x SP#${p.id}`)
            .join(', ');

        sheet.addRow({
            index: order.order_index,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            products,
            total_amount: order.total_amount,
            scheduled_time: order.scheduled_time
                ? new Date(order.scheduled_time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                : '',
            status: getStatusText(order.status),
            error: order.error_message || '',
            bill_id: order.bill_id || '',
        });
    });

    // Format currency column
    sheet.getColumn('total_amount').numFmt = '#,##0';

    // Auto-download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `don-hang_${batchId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function exportDashboardToExcel(stats: any, batchId?: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    // Status breakdown sheet
    if (stats.statusBreakdown?.length > 0) {
        const statusSheet = workbook.addWorksheet('Tổng quan trạng thái');
        statusSheet.columns = [
            { header: 'Trạng thái', key: 'status', width: 20 },
            { header: 'Số lượng', key: 'count', width: 15 },
            { header: 'Doanh thu (VNĐ)', key: 'revenue', width: 20 },
        ];
        statusSheet.getRow(1).font = { bold: true };
        stats.statusBreakdown.forEach((item: any) => {
            statusSheet.addRow({
                status: getStatusText(item.status || item.name),
                count: item.count || item.value,
                revenue: item.revenue || 0,
            });
        });
        statusSheet.getColumn('revenue').numFmt = '#,##0';
    }

    // Revenue by date sheet
    if (stats.revenueByDate?.length > 0) {
        const revenueSheet = workbook.addWorksheet('Doanh số theo ngày');
        revenueSheet.columns = [
            { header: 'Ngày', key: 'date', width: 15 },
            { header: 'Tổng doanh số (VNĐ)', key: 'total', width: 22 },
            { header: 'Đã hoàn thành (VNĐ)', key: 'completed', width: 22 },
            { header: 'Số đơn', key: 'count', width: 12 },
        ];
        revenueSheet.getRow(1).font = { bold: true };
        stats.revenueByDate.forEach((item: any) => {
            revenueSheet.addRow({
                date: item.date,
                total: item.total || item.totalRevenue || 0,
                completed: item.completed || item.completedRevenue || 0,
                count: item.count || item.orderCount || 0,
            });
        });
        revenueSheet.getColumn('total').numFmt = '#,##0';
        revenueSheet.getColumn('completed').numFmt = '#,##0';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao_${batchId || 'dashboard'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}
