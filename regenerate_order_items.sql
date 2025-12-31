-- Script để kiểm tra và gen lại data cho bảng order_items
-- Chạy script này nếu data trong order_items không đúng hoặc thiếu

-- 1. Kiểm tra số lượng records hiện tại
SELECT 
    'Tổng số records trong order_items' as description,
    COUNT(*) as count
FROM public.order_items;

SELECT 
    'Số records có product_name null hoặc rỗng' as description,
    COUNT(*) as count
FROM public.order_items
WHERE product_name IS NULL OR product_name = '';

SELECT 
    'Số records có product_id null' as description,
    COUNT(*) as count
FROM public.order_items
WHERE product_id IS NULL;

-- 2. Xóa tất cả data cũ (nếu cần)
-- UNCOMMENT dòng dưới nếu muốn xóa hết và gen lại từ đầu
-- DELETE FROM public.order_items;

-- 3. Gen lại data từ orders_queue
-- Script này sẽ:
-- - Lấy tất cả orders từ orders_queue có order_data chứa products
-- - Extract thông tin sản phẩm và insert vào order_items
-- - Đảm bảo product_name, product_code, product_id được điền đầy đủ

DO $$
DECLARE
    r RECORD;
    p jsonb;
    product_name_val text;
    product_code_val text;
    product_id_val integer;
    quantity_val integer;
    price_val numeric;
    total_price_val numeric;
    inserted_count integer := 0;
    skipped_count integer := 0;
BEGIN
    -- Xóa tất cả records cũ để tránh duplicate
    DELETE FROM public.order_items;
    
    RAISE NOTICE 'Bắt đầu gen lại data cho order_items...';
    
    -- Duyệt qua tất cả orders trong orders_queue
    FOR r IN 
        SELECT 
            id,
            batch_id,
            order_data,
            created_at
        FROM public.orders_queue 
        WHERE order_data IS NOT NULL 
        AND order_data ? 'products'
        ORDER BY id
    LOOP
        -- Kiểm tra nếu order_data có products
        IF r.order_data->'products' IS NOT NULL THEN
            -- Duyệt qua từng sản phẩm trong order
            FOR p IN SELECT * FROM jsonb_array_elements(r.order_data->'products')
            LOOP
                -- Extract thông tin sản phẩm
                product_id_val := (p->>'id')::integer;
                product_code_val := p->>'code';
                product_name_val := p->>'name';
                quantity_val := COALESCE((p->>'quantity')::integer, 1);
                price_val := COALESCE((p->>'price')::numeric, 0);
                total_price_val := quantity_val * price_val;
                
                -- Đảm bảo có ít nhất product_id hoặc product_name
                IF product_id_val IS NULL AND (product_name_val IS NULL OR product_name_val = '') THEN
                    skipped_count := skipped_count + 1;
                    CONTINUE;
                END IF;
                
                -- Nếu thiếu product_name, dùng product_code hoặc product_id
                IF product_name_val IS NULL OR product_name_val = '' THEN
                    IF product_code_val IS NOT NULL AND product_code_val != '' THEN
                        product_name_val := product_code_val;
                    ELSIF product_id_val IS NOT NULL THEN
                        product_name_val := 'Sản phẩm ' || product_id_val::text;
                    ELSE
                        product_name_val := 'Sản phẩm không xác định';
                    END IF;
                END IF;
                
                -- Nếu thiếu product_code, dùng product_id
                IF product_code_val IS NULL OR product_code_val = '' THEN
                    IF product_id_val IS NOT NULL THEN
                        product_code_val := product_id_val::text;
                    ELSE
                        product_code_val := 'N/A';
                    END IF;
                END IF;
                
                -- Insert vào order_items
                BEGIN
                    INSERT INTO public.order_items (
                        order_queue_id,
                        batch_id,
                        product_id,
                        product_code,
                        product_name,
                        quantity,
                        price,
                        total_price,
                        created_at
                    ) VALUES (
                        r.id,
                        r.batch_id,
                        product_id_val,
                        product_code_val,
                        product_name_val,
                        quantity_val,
                        price_val,
                        total_price_val,
                        r.created_at
                    );
                    
                    inserted_count := inserted_count + 1;
                EXCEPTION WHEN OTHERS THEN
                    skipped_count := skipped_count + 1;
                    RAISE NOTICE 'Lỗi khi insert order_item: %', SQLERRM;
                END;
            END LOOP;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Hoàn thành! Đã insert % records, bỏ qua % records', inserted_count, skipped_count;
END;
$$;

-- 4. Kiểm tra kết quả sau khi gen lại
SELECT 
    'Tổng số records sau khi gen lại' as description,
    COUNT(*) as count
FROM public.order_items;

SELECT 
    'Số records có product_name null hoặc rỗng (sau khi gen lại)' as description,
    COUNT(*) as count
FROM public.order_items
WHERE product_name IS NULL OR product_name = '';

-- 5. Thống kê theo sản phẩm
SELECT 
    product_name,
    product_code,
    COUNT(*) as order_count,
    SUM(quantity) as total_quantity,
    SUM(total_price) as total_revenue
FROM public.order_items
GROUP BY product_name, product_code
ORDER BY total_quantity DESC
LIMIT 20;

-- 6. Thống kê theo batch
SELECT 
    batch_id,
    COUNT(*) as item_count,
    COUNT(DISTINCT product_id) as unique_products,
    SUM(quantity) as total_quantity,
    SUM(total_price) as total_revenue
FROM public.order_items
GROUP BY batch_id
ORDER BY batch_id;










