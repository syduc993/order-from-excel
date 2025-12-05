// Helper methods for dashboard stats calculations
export const calculateStatusBreakdown = (orders: any[]) => {
    const breakdown = {
        completed: 0,
        pending: 0,
        failed: 0,
        cancelled: 0,
    };

    orders.forEach((order) => {
        if (order.status in breakdown) {
            breakdown[order.status as keyof typeof breakdown]++;
        }
    });

    return [
        { name: 'Completed', value: breakdown.completed, color: '#22c55e' },
        { name: 'Pending', value: breakdown.pending, color: '#eab308' },
        { name: 'Failed', value: breakdown.failed, color: '#ef4444' },
        { name: 'Cancelled', value: breakdown.cancelled, color: '#6b7280' },
    ];
};

export const calculateHistogramCount = (orders: any[]) => {
    const hourCounts: any = {};

    orders.forEach((order) => {
        const date = new Date(order.scheduled_time);
        const hour = date.getUTCHours();

        if (!hourCounts[hour]) {
            hourCounts[hour] = { hour, completed: 0, pending: 0, failed: 0, cancelled: 0 };
        }

        hourCounts[hour][order.status]++;
    });

    return Object.values(hourCounts);
};

export const calculateHistogramAmount = (orders: any[]) => {
    const hourAmounts: any = {};

    orders.forEach((order) => {
        const date = new Date(order.scheduled_time);
        const hour = date.getUTCHours();

        if (!hourAmounts[hour]) {
            hourAmounts[hour] = { hour, completed: 0, pending: 0, failed: 0, cancelled: 0 };
        }

        hourAmounts[hour][order.status] += order.total_amount || 0;
    });

    return Object.values(hourAmounts);
};

export const calculateRevenueByDate = (orders: any[]) => {
    const dateRevenue: any = {};

    orders.forEach((order) => {
        const date = new Date(order.scheduled_time);
        const dateKey = date.toISOString().split('T')[0];

        if (!dateRevenue[dateKey]) {
            dateRevenue[dateKey] = { date: dateKey, total: 0, completed: 0 };
        }

        dateRevenue[dateKey].total += order.total_amount || 0;
        if (order.status === 'completed') {
            dateRevenue[dateKey].completed += order.total_amount || 0;
        }
    });

    return Object.values(dateRevenue).sort((a: any, b: any) => a.date.localeCompare(b.date));
};

export const calculateRevenueByHour = (orders: any[]) => {
    const hourRevenue: any = {};

    orders.forEach((order) => {
        const date = new Date(order.scheduled_time);
        const hour = date.getUTCHours();

        if (!hourRevenue[hour]) {
            hourRevenue[hour] = { hour, total: 0, completed: 0 };
        }

        hourRevenue[hour].total += order.total_amount || 0;
        if (order.status === 'completed') {
            hourRevenue[hour].completed += order.total_amount || 0;
        }
    });

    return Object.values(hourRevenue);
};

export const calculateProductQuantityByDate = (orders: any[]) => {
    const dateQuantity: any = {};

    orders.forEach((order) => {
        const date = new Date(order.scheduled_time);
        const dateKey = date.toISOString().split('T')[0];

        if (!dateQuantity[dateKey]) {
            dateQuantity[dateKey] = {
                date: dateKey,
                total_quantity: 0,
                completed_quantity: 0,
                pending_quantity: 0,
                failed_quantity: 0,
                cancelled_quantity: 0,
            };
        }

        const products = order.order_data?.products || [];
        const totalQty = products.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);

        dateQuantity[dateKey].total_quantity += totalQty;
        dateQuantity[dateKey][`${order.status}_quantity`] += totalQty;
    });

    return Object.values(dateQuantity).sort((a: any, b: any) => a.date.localeCompare(b.date));
};
