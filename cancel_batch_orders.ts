import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

interface CancelStats {
    totalCancelled: number;
    errors: string[];
}

async function cancelBatchOrdersFromDate(batchId: string, fromDate: Date, skipConfirm: boolean = false): Promise<void> {
    // Lấy thông tin từ environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Thiếu thông tin kết nối Supabase!');
        console.error('Vui lòng đảm bảo có các biến môi trường:');
        console.error('  - VITE_SUPABASE_URL hoặc SUPABASE_URL');
        console.error('  - VITE_SUPABASE_ANON_KEY hoặc SUPABASE_ANON_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Đang kiểm tra batch và đơn hàng...\n');
    console.log(`📦 Batch ID: ${batchId}`);
    console.log(`📅 Hủy từ ngày: ${fromDate.toISOString().split('T')[0]}\n`);

    // Kiểm tra batch có tồn tại không
    const { data: batch, error: batchError } = await supabase
        .from('order_batches')
        .select('*')
        .eq('id', batchId)
        .single();

    if (batchError || !batch) {
        console.error(`❌ Không tìm thấy batch: ${batchId}`);
        console.error('Lỗi:', batchError?.message || 'Batch không tồn tại');
        process.exit(1);
    }

    console.log(`✅ Tìm thấy batch:`);
    console.log(`   - Ngày bắt đầu: ${batch.start_date}`);
    console.log(`   - Ngày kết thúc: ${batch.end_date}`);
    console.log(`   - Tổng đơn hàng: ${batch.total_orders}\n`);

    // Đếm số đơn hàng pending từ ngày fromDate trở đi
    const fromDateISO = fromDate.toISOString();
    const { count, error: countError } = await supabase
        .from('orders_queue')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batchId)
        .eq('status', 'pending')
        .gte('scheduled_time', fromDateISO);

    if (countError) {
        console.error('❌ Lỗi khi đếm đơn hàng:', countError.message);
        process.exit(1);
    }

    const totalPending = count || 0;

    if (totalPending === 0) {
        console.log('✅ Không có đơn hàng pending nào từ ngày này trở đi');
        return;
    }

    console.log(`📊 Tìm thấy ${totalPending.toLocaleString('vi-VN')} đơn hàng pending từ ngày ${fromDate.toISOString().split('T')[0]} trở đi\n`);

    // Xác nhận từ người dùng (nếu không có flag --yes)
    if (!skipConfirm) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
            rl.question(`Bạn có chắc chắn muốn hủy ${totalPending.toLocaleString('vi-VN')} đơn hàng? (yes/no): `, resolve);
        });

        rl.close();

        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('❌ Đã hủy thao tác');
            return;
        }
    }

    const stats: CancelStats = {
        totalCancelled: 0,
        errors: [],
    };

    console.log('\n🚀 Bắt đầu hủy đơn hàng...\n');

    try {
        // Cập nhật status thành 'cancelled' cho tất cả đơn hàng pending từ fromDate
        const { data: cancelledOrders, error: updateError, count: cancelledCount } = await supabase
            .from('orders_queue')
            .update({ status: 'cancelled' })
            .eq('batch_id', batchId)
            .eq('status', 'pending')
            .gte('scheduled_time', fromDateISO)
            .select('id', { count: 'exact' });

        if (updateError) {
            throw new Error(`Lỗi khi hủy đơn hàng: ${updateError.message}`);
        }

        const cancelled = cancelledCount || cancelledOrders?.length || 0;
        stats.totalCancelled = cancelled;

        console.log(`✅ Đã hủy ${cancelled.toLocaleString('vi-VN')} đơn hàng thành công!`);

    } catch (error: any) {
        const errorMsg = error.message || String(error);
        stats.errors.push(errorMsg);
        console.error(`❌ Lỗi:`, errorMsg);
    }

    // Tóm tắt kết quả
    console.log('\n' + '='.repeat(50));
    console.log('📊 TÓM TẮT KẾT QUẢ');
    console.log('='.repeat(50));
    console.log(`✅ Tổng số đơn hàng đã hủy: ${stats.totalCancelled.toLocaleString('vi-VN')}`);
    if (stats.errors.length > 0) {
        console.log(`⚠️  Số lỗi: ${stats.errors.length}`);
        console.log('\nChi tiết lỗi:');
        stats.errors.forEach((err, idx) => {
            console.log(`  ${idx + 1}. ${err}`);
        });
    } else {
        console.log('✅ Không có lỗi nào!');
    }
    console.log('='.repeat(50) + '\n');
}

// Lấy tham số từ command line
const args = process.argv.slice(2);
const batchId = args.find(arg => arg.startsWith('batch_')) || 'batch_1766198943476';
const skipConfirm = args.includes('--yes') || args.includes('-y');
const fromDateStr = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-') && arg !== batchId);

let fromDate: Date;

if (fromDateStr) {
    // Nếu là số, coi như là ngày trong tháng hiện tại
    const dayNum = parseInt(fromDateStr);
    if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
        const now = new Date();
        fromDate = new Date(now.getFullYear(), now.getMonth(), dayNum);
    } else {
        // Nếu là chuỗi date, parse nó
        fromDate = new Date(fromDateStr);
    }
} else {
    // Mặc định: hôm nay
    fromDate = new Date();
}

// Đảm bảo fromDate là đầu ngày (00:00:00)
fromDate.setHours(0, 0, 0, 0);

// Chạy script
cancelBatchOrdersFromDate(batchId, fromDate, skipConfirm)
    .then(() => {
        console.log('✨ Hoàn thành!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Lỗi không mong muốn:', error);
        process.exit(1);
    });

