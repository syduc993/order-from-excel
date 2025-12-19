import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

const BATCH_SIZE = 1000; // Xóa 1000 bản ghi mỗi lần để tránh vượt limit

interface DeleteStats {
    totalDeleted: number;
    batchesProcessed: number;
    errors: string[];
}

async function deleteCancelledOrders(): Promise<void> {
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

    console.log('🔍 Đang kiểm tra số lượng bản ghi cancelled...\n');

    // Đếm tổng số bản ghi cancelled
    const { count, error: countError } = await supabase
        .from('orders_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled');

    if (countError) {
        console.error('❌ Lỗi khi đếm bản ghi:', countError.message);
        process.exit(1);
    }

    const totalCancelled = count || 0;

    if (totalCancelled === 0) {
        console.log('✅ Không có bản ghi nào có status = "cancelled"');
        return;
    }

    console.log(`📊 Tìm thấy ${totalCancelled.toLocaleString('vi-VN')} bản ghi cancelled`);
    console.log(`🔄 Sẽ xóa theo batch, mỗi batch ${BATCH_SIZE} bản ghi\n`);

    // Xác nhận từ người dùng
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
        rl.question('Bạn có muốn tiếp tục xóa? (yes/no): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Đã hủy thao tác');
        return;
    }

    const stats: DeleteStats = {
        totalDeleted: 0,
        batchesProcessed: 0,
        errors: [],
    };

    console.log('\n🚀 Bắt đầu xóa...\n');

    // Xóa theo batch
    while (stats.totalDeleted < totalCancelled) {
        try {
            // Lấy ID của các bản ghi cancelled (giới hạn BATCH_SIZE)
            const { data: idsToDelete, error: selectError } = await supabase
                .from('orders_queue')
                .select('id')
                .eq('status', 'cancelled')
                .limit(BATCH_SIZE);

            if (selectError) {
                throw new Error(`Lỗi khi lấy danh sách ID: ${selectError.message}`);
            }

            if (!idsToDelete || idsToDelete.length === 0) {
                console.log('✅ Đã xóa hết các bản ghi cancelled');
                break;
            }

            const ids = idsToDelete.map((row) => row.id);

            // Xóa batch này
            const { error: deleteError, count: deletedCount } = await supabase
                .from('orders_queue')
                .delete()
                .in('id', ids)
                .select('*', { count: 'exact', head: true });

            if (deleteError) {
                throw new Error(`Lỗi khi xóa: ${deleteError.message}`);
            }

            const deleted = deletedCount || ids.length;
            stats.totalDeleted += deleted;
            stats.batchesProcessed++;

            console.log(
                `✅ Batch ${stats.batchesProcessed}: Đã xóa ${deleted.toLocaleString('vi-VN')} bản ghi ` +
                `(Tổng: ${stats.totalDeleted.toLocaleString('vi-VN')}/${totalCancelled.toLocaleString('vi-VN')})`
            );

            // Nghỉ một chút để tránh rate limit
            if (stats.totalDeleted < totalCancelled) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        } catch (error: any) {
            const errorMsg = error.message || String(error);
            stats.errors.push(errorMsg);
            console.error(`❌ Lỗi trong batch ${stats.batchesProcessed + 1}:`, errorMsg);

            // Nếu lỗi nghiêm trọng, dừng lại
            if (errorMsg.includes('permission') || errorMsg.includes('policy')) {
                console.error('\n❌ Lỗi quyền truy cập. Vui lòng kiểm tra RLS policies của Supabase.');
                break;
            }

            // Tiếp tục với batch tiếp theo sau 2 giây
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    // Tóm tắt kết quả
    console.log('\n' + '='.repeat(50));
    console.log('📊 TÓM TẮT KẾT QUẢ');
    console.log('='.repeat(50));
    console.log(`✅ Tổng số bản ghi đã xóa: ${stats.totalDeleted.toLocaleString('vi-VN')}`);
    console.log(`🔄 Số batch đã xử lý: ${stats.batchesProcessed}`);
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

// Chạy script
deleteCancelledOrders()
    .then(() => {
        console.log('✨ Hoàn thành!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Lỗi không mong muốn:', error);
        process.exit(1);
    });



