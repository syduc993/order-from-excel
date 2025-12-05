-- Migration: Add indexes for orders_queue table to optimize dashboard queries
-- Run this migration to improve dashboard query performance

-- Create indexes for orders_queue to optimize dashboard queries
CREATE INDEX IF NOT EXISTS idx_orders_queue_batch_id ON public.orders_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_queue_scheduled_time ON public.orders_queue(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_orders_queue_status ON public.orders_queue(status);

-- Composite indexes for common filter combinations (further optimization)
CREATE INDEX IF NOT EXISTS idx_orders_queue_batch_status ON public.orders_queue(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_queue_scheduled_status ON public.orders_queue(scheduled_time, status);

-- Note: These indexes will significantly improve query performance when filtering by:
-- - batch_id
-- - scheduled_time (date range)
-- - status
-- - Combinations of the above

