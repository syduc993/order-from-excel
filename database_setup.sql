-- Create table order_items
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_queue_id bigint REFERENCES public.orders_queue(id) ON DELETE CASCADE,
    batch_id text REFERENCES public.order_batches(id) ON DELETE CASCADE,
    product_id integer,
    product_code text,
    product_name text,
    quantity integer,
    price numeric,
    total_price numeric,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_order_items_batch_id ON public.order_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON public.order_items(created_at);

-- Create indexes for orders_queue to optimize dashboard queries
CREATE INDEX IF NOT EXISTS idx_orders_queue_batch_id ON public.orders_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_queue_scheduled_time ON public.orders_queue(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_orders_queue_status ON public.orders_queue(status);
-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_orders_queue_batch_status ON public.orders_queue(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_queue_scheduled_status ON public.orders_queue(scheduled_time, status);

-- Function to sync order_items from orders_queue
CREATE OR REPLACE FUNCTION public.sync_order_items()
RETURNS TRIGGER AS $$
DECLARE
    p jsonb;
BEGIN
    -- Only proceed if order_data has changed or it's a new record
    IF (TG_OP = 'UPDATE' AND OLD.order_data = NEW.order_data) THEN
        RETURN NEW;
    END IF;

    -- Delete existing items for this order (in case of update)
    DELETE FROM public.order_items WHERE order_queue_id = NEW.id;

    -- Insert new items
    IF NEW.order_data ? 'products' THEN
        FOR p IN SELECT * FROM jsonb_array_elements(NEW.order_data->'products')
        LOOP
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
                NEW.id,
                NEW.batch_id,
                (p->>'id')::integer,
                p->>'code',
                p->>'name',
                (p->>'quantity')::integer,
                (p->>'price')::numeric,
                ((p->>'quantity')::integer * (p->>'price')::numeric),
                NEW.created_at
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
DROP TRIGGER IF EXISTS tr_sync_order_items ON public.orders_queue;
CREATE TRIGGER tr_sync_order_items
    AFTER INSERT OR UPDATE OF order_data ON public.orders_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_order_items();

-- Backfill existing data (Optional - run if you want to populate for existing batches)
-- Clear incorrect data first to ensure dates are correct
DELETE FROM public.order_items;

-- Simple backfill for existing data:
DO $$
DECLARE
    r RECORD;
    p jsonb;
BEGIN
    FOR r IN SELECT * FROM public.orders_queue WHERE order_data ? 'products' LOOP
        -- Check if items already exist to avoid duplicates if running multiple times
        IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_queue_id = r.id) THEN
            FOR p IN SELECT * FROM jsonb_array_elements(r.order_data->'products')
            LOOP
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
                    (p->>'id')::integer,
                    p->>'code',
                    p->>'name',
                    (p->>'quantity')::integer,
                    (p->>'price')::numeric,
                    ((p->>'quantity')::integer * (p->>'price')::numeric),
                    r.created_at
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$$;
