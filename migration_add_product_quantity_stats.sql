-- Function to get product quantity statistics by date
CREATE OR REPLACE FUNCTION public.get_product_quantity_by_date(
    p_batch_id text DEFAULT NULL,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_statuses text[] DEFAULT NULL
)
RETURNS TABLE (
    date text,
    total_quantity bigint,
    completed_quantity bigint,
    pending_quantity bigint,
    cancelled_quantity bigint,
    failed_quantity bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date timestamp with time zone;
    v_end_date timestamp with time zone;
BEGIN
    -- Parse dates if provided
    IF p_start_date IS NOT NULL THEN
        v_start_date := p_start_date::timestamp with time zone;
    END IF;
    
    IF p_end_date IS NOT NULL THEN
        v_end_date := p_end_date::timestamp with time zone;
    END IF;

    RETURN QUERY
    WITH daily_data AS (
        SELECT
            to_char(scheduled_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as date_key,
            status,
            COALESCE((p->>'quantity')::int, 0) as quantity
        FROM
            public.orders_queue,
            jsonb_array_elements(order_data->'products') as p
        WHERE
            (p_batch_id IS NULL OR batch_id = p_batch_id)
            AND (v_start_date IS NULL OR scheduled_time >= v_start_date)
            AND (v_end_date IS NULL OR scheduled_time <= v_end_date)
            AND (p_statuses IS NULL OR status = ANY(p_statuses))
    )
    SELECT
        date_key as date,
        sum(quantity)::bigint as total_quantity,
        sum(CASE WHEN status = 'completed' THEN quantity ELSE 0 END)::bigint as completed_quantity,
        sum(CASE WHEN status = 'pending' THEN quantity ELSE 0 END)::bigint as pending_quantity,
        sum(CASE WHEN status = 'cancelled' THEN quantity ELSE 0 END)::bigint as cancelled_quantity,
        sum(CASE WHEN status = 'failed' THEN quantity ELSE 0 END)::bigint as failed_quantity
    FROM daily_data
    GROUP BY date_key
    ORDER BY date_key;
END;
$$;
