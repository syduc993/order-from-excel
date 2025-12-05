import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log('Querying orders_queue...');

    // Query for the relevant date range
    const { data, error } = await supabase
        .from('orders_queue')
        .select('scheduled_time, created_at, total_amount, status')
        .gte('scheduled_time', '2025-11-28T00:00:00')
        .lte('scheduled_time', '2025-12-05T23:59:59')
        .range(0, 9999);

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Aggregate by Scheduled Time
    const byScheduled = {};
    // Aggregate by Created At
    const byCreated = {};

    data.forEach(order => {
        const scheduledDate = new Date(order.scheduled_time).toISOString().split('T')[0];
        const createdDate = new Date(order.created_at).toISOString().split('T')[0];
        const amount = order.total_amount || 0;

        if (!byScheduled[scheduledDate]) byScheduled[scheduledDate] = 0;
        byScheduled[scheduledDate] += amount;

        if (!byCreated[createdDate]) byCreated[createdDate] = 0;
        byCreated[createdDate] += amount;
    });

    console.log('\n--- Revenue by Scheduled Time ---');
    Object.keys(byScheduled).sort().forEach(date => {
        console.log(`${date}: ${new Intl.NumberFormat('vi-VN').format(byScheduled[date])}`);
    });

    console.log('\n--- Revenue by Created At ---');
    Object.keys(byCreated).sort().forEach(date => {
        console.log(`${date}: ${new Intl.NumberFormat('vi-VN').format(byCreated[date])}`);
    });
}

run();
