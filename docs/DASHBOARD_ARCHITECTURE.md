# Dashboard Architecture Documentation

## 1. Database Schema

### Tables Overview

#### `orders_queue`
Bảng lưu trữ thông tin đơn hàng chính.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint (PK) | ID tự động tăng của đơn hàng |
| `batch_id` | text (FK) | ID của batch (đợt phát sinh đơn) |
| `order_data` | jsonb | Dữ liệu JSON chứa thông tin đơn hàng đầy đủ |
| `scheduled_time` | timestamp | Thời gian dự kiến gửi đơn |
| `status` | text | Trạng thái đơn hàng (pending, processing, completed, failed) |
| `created_at` | timestamp | Thời gian tạo đơn hàng |

**Structure of `order_data` (JSONB):**
```json
{
  "customer": {
    "name": "...",
    "phone": "...",
    "address": "..."
  },
  "products": [
    {
      "id": 123,
      "code": "SP001",
      "name": "Tên sản phẩm",
      "quantity": 2,
      "price": 100000
    }
  ]
}
```

#### `order_items`
Bảng phẳng hóa (denormalized) từ `orders_queue.order_data->products`. Được đồng bộ tự động qua trigger.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | ID duy nhất của item |
| `order_queue_id` | bigint (FK) | Tham chiếu đến `orders_queue.id` |
| `batch_id` | text (FK) | ID của batch |
| `product_id` | integer | ID sản phẩm |
| `product_code` | text | Mã sản phẩm |
| `product_name` | text | Tên sản phẩm |
| `quantity` | integer | Số lượng |
| `price` | numeric | Đơn giá |
| `total_price` | numeric | Tổng tiền (quantity × price) |
| `created_at` | timestamp | Thời gian tạo đơn (copy từ `orders_queue.created_at`) |

**Indexes:**
- `idx_order_items_batch_id` on `batch_id`
- `idx_order_items_product_id` on `product_id`
- `idx_order_items_created_at` on `created_at`

#### `order_batches`
Bảng quản lý các batch.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | ID của batch (format: `batch_<timestamp>`) |
| `created_at` | timestamp | Thời gian tạo batch |

### Data Synchronization

**Trigger: `tr_sync_order_items`**
- Tự động chạy khi `INSERT` hoặc `UPDATE` vào `orders_queue`
- Xóa các `order_items` cũ của đơn hàng
- Tạo mới các `order_items` từ `order_data->products`
- Copy `created_at` từ `orders_queue` để đảm bảo tính nhất quán về thời gian

**Flow:**
```
orders_queue (INSERT/UPDATE)
    ↓ (trigger)
order_items (DELETE old + INSERT new)
```

---

## 2. Dashboard Query Flow

### 2.1. Client Request

User truy cập `/dashboard` và có thể filter theo:
- **Batch ID** (optional)
- **Date Range**: `startDate` - `endDate` (optional)
- **Product Name** (optional, tìm kiếm ILIKE)

### 2.2. Backend Query Logic

**File:** `src/services/supabase.ts`  
**Method:** `getDashboardStats(filters)`

#### Step 1: Query `order_items` table
```typescript
let itemsQuery = this.client
  .from('order_items')
  .select('product_id, product_code, product_name, quantity, total_price, created_at');

if (filters.batchId) itemsQuery = itemsQuery.eq('batch_id', filters.batchId);
if (filters.startDate) itemsQuery = itemsQuery.gte('created_at', filters.startDate.toISOString());
if (filters.endDate) itemsQuery = itemsQuery.lte('created_at', filters.endDate.toISOString());
if (filters.productName) itemsQuery = itemsQuery.ilike('product_name', `%${filters.productName}%`);

const { data: items } = await itemsQuery;
```

**Result:** Danh sách các `order_items` thỏa điều kiện filter.

#### Step 2: Query `orders_queue` table
```typescript
let ordersQuery = this.client
  .from('orders_queue')
  .select('scheduled_time, status, created_at');

if (filters.batchId) ordersQuery = ordersQuery.eq('batch_id', filters.batchId);
if (filters.startDate) ordersQuery = ordersQuery.gte('created_at', filters.startDate.toISOString());
if (filters.endDate) ordersQuery = ordersQuery.lte('created_at', filters.endDate.toISOString());

const { data: orders } = await ordersQuery;
```

**Result:** Danh sách các đơn hàng thỏa điều kiện filter.

> **⚠️ Vấn đề:** Khi filter theo `productName`, `orders_queue` không có thông tin sản phẩm trực tiếp, nên biểu đồ "Phân bổ đơn hàng theo giờ" có thể không khớp với biểu đồ sản phẩm.

#### Step 3: Return raw data
```typescript
return {
  items: items || [],
  orders: orders || []
};
```

### 2.3. Frontend Processing

**File:** `src/pages/Dashboard.tsx`  
**Method:** `processData()`

Sau khi nhận raw data từ backend, frontend xử lý để tạo các chart data:

#### Chart 1: Top 20 Sản Phẩm Bán Chạy
```typescript
const productMap = new Map<string, number>();
stats.items.forEach((item: any) => {
  const key = item.product_name;
  productMap.set(key, (productMap.get(key) || 0) + item.quantity);
});

const productStats = Array.from(productMap.entries())
  .map(([name, quantity]) => ({ name, quantity }))
  .sort((a, b) => b.quantity - a.quantity)
  .slice(0, 20);
```

**Display:**
- Bar chart
- X-axis: Tên sản phẩm
- Y-axis: Tổng số lượng bán

#### Chart 2: Doanh Thu Theo Ngày
```typescript
const revenueMap = new Map<string, number>();
stats.items.forEach((item: any) => {
  const date = new Date(item.created_at).toLocaleDateString('vi-VN');
  revenueMap.set(date, (revenueMap.get(date) || 0) + item.total_price);
});

const revenueStats = Array.from(revenueMap.entries())
  .map(([date, total]) => ({ date, total }))
  .sort((a, b) => /* sort by date */);
```

**Display:**
- Area chart
- X-axis: Ngày (dd/MM/yyyy)
- Y-axis: Tổng doanh thu (VNĐ)

#### Chart 3: Phân Bổ Đơn Hàng Theo Giờ
```typescript
const timeMap = new Map<string, number>();
stats.orders.forEach((order: any) => {
  if (order.scheduled_time) {
    const hour = new Date(order.scheduled_time).getHours();
    const key = `${hour}:00`;
    timeMap.set(key, (timeMap.get(key) || 0) + 1);
  }
});

const timeStats = Array.from(timeMap.entries())
  .map(([time, count]) => ({ time, count }))
  .sort((a, b) => parseInt(a.time) - parseInt(b.time));
```

**Display:**
- Line chart
- X-axis: Giờ trong ngày (0:00 - 23:00)
- Y-axis: Số lượng đơn hàng

---

## 3. Current Issues & Limitations

### 3.1. Performance Issues

#### ❌ Problem: Fetch toàn bộ raw data về client
- Không có aggregation ở database level
- Client phải xử lý tất cả dữ liệu
- Với dataset lớn (10k+ đơn hàng), query trả về rất nhiều rows

#### ❌ Problem: Multiple aggregations trên client
- 3 loops riêng biệt qua cùng 1 dataset
- Không tận dụng được database indexing
- Tốn memory & CPU ở browser

### 3.2. Data Consistency Issues

#### ❌ Problem: Inconsistent filtering
- `orders` query không biết về `productName` filter
- Khi filter theo sản phẩm, biểu đồ "Phân bổ theo giờ" vẫn hiển thị TẤT CẢ đơn hàng
- Gây nhầm lẫn cho người dùng

### 3.3. Chart Data Quality

#### ❌ Problem: Date formatting issues
- `toLocaleDateString('vi-VN')` có thể cho format khác nhau trên các môi trường
- Sort date bằng string parsing không reliable
- Timezone có thể gây sai lệch

#### ❌ Problem: Missing data for orders without `scheduled_time`
- Chart "Phân bổ theo giờ" bỏ qua các đơn không có `scheduled_time`
- Không có indicator cho user về missing data

---

## 4. Recommended Improvements

### 4.1. Use Database Aggregation

**Current:**
```typescript
// Fetch all items, aggregate on client
const { data: items } = await itemsQuery;
// ... client-side grouping
```

**Better approach:**
```sql
-- Aggregation ở database
SELECT 
  product_name,
  SUM(quantity) as total_quantity,
  SUM(total_price) as total_revenue,
  COUNT(*) as order_count
FROM order_items
WHERE [filters]
GROUP BY product_name
ORDER BY total_quantity DESC
LIMIT 20
```

### 4.2. Fix Product Filter Consistency

Khi filter theo `productName`, cần query `orders_queue` dựa trên `order_items`:

```sql
-- Get orders that contain the filtered product
SELECT DISTINCT o.*
FROM orders_queue o
INNER JOIN order_items i ON o.id = i.order_queue_id
WHERE i.product_name ILIKE '%search%'
  AND [other filters]
```

### 4.3. Add Materialized View (Optional)

Tạo materialized view cho dashboard stats để tăng performance:

```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
  batch_id,
  DATE(created_at) as date,
  product_name,
  SUM(quantity) as total_quantity,
  SUM(total_price) as total_revenue
FROM order_items
GROUP BY batch_id, DATE(created_at), product_name;

-- Refresh định kỳ hoặc sau mỗi batch insert
REFRESH MATERIALIZED VIEW dashboard_stats;
```

### 4.4. Add RPC Functions

Thay vì fetch raw data, tạo PostgreSQL functions trả về aggregated data:

```sql
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_batch_id text DEFAULT NULL,
  p_start_date timestamp DEFAULT NULL,
  p_end_date timestamp DEFAULT NULL,
  p_product_name text DEFAULT NULL
)
RETURNS TABLE (
  product_stats jsonb,
  revenue_stats jsonb,
  time_stats jsonb
) AS $$
BEGIN
  -- Complex aggregation logic here
  RETURN QUERY ...
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Data Flow Diagram

```
┌─────────────┐
│   Browser   │
│  Dashboard  │
└──────┬──────┘
       │ 1. Apply filters (batchId, dates, productName)
       ↓
┌──────────────────┐
│ getDashboardStats│
│  (supabase.ts)   │
└──────┬───────────┘
       │ 2a. Query order_items (filtered)
       │ 2b. Query orders_queue (filtered)
       ↓
┌──────────────┐
│   Supabase   │
│   Database   │
└──────┬───────┘
       │ 3. Return raw arrays
       ↓
┌──────────────────┐
│  processData()   │
│  (Dashboard.tsx) │
└──────┬───────────┘
       │ 4a. Aggregate products by name
       │ 4b. Aggregate revenue by date
       │ 4c. Aggregate orders by hour
       ↓
┌──────────────┐
│   Recharts   │
│   (Display)  │
└──────────────┘
```

---

## 6. Query Examples

### Example 1: Get all data for batch
```typescript
getDashboardStats({ 
  batchId: 'batch_1717171717171' 
})
```

```sql
-- Query 1
SELECT product_id, product_code, product_name, quantity, total_price, created_at
FROM order_items
WHERE batch_id = 'batch_1717171717171'

-- Query 2
SELECT scheduled_time, status, created_at
FROM orders_queue
WHERE batch_id = 'batch_1717171717171'
```

### Example 2: Get data for date range
```typescript
getDashboardStats({ 
  startDate: new Date('2024-11-20'),
  endDate: new Date('2024-11-24')
})
```

```sql
-- Query 1
SELECT ...
FROM order_items
WHERE created_at >= '2024-11-20T00:00:00.000Z'
  AND created_at <= '2024-11-24T23:59:59.999Z'

-- Query 2
SELECT ...
FROM orders_queue
WHERE created_at >= '2024-11-20T00:00:00.000Z'
  AND created_at <= '2024-11-24T23:59:59.999Z'
```

### Example 3: Search by product name
```typescript
getDashboardStats({ 
  productName: 'iPhone' 
})
```

```sql
-- Query 1
SELECT ...
FROM order_items
WHERE product_name ILIKE '%iPhone%'

-- Query 2 (⚠️ ISSUE: không filter theo product)
SELECT ...
FROM orders_queue
-- No filter on product_name!
```

---

## Summary

### Current Architecture
- ✅ Simple implementation
- ✅ Works for small datasets
- ❌ Poor performance for large datasets
- ❌ All processing happens on client-side
- ❌ Inconsistent filtering logic
- ❌ No caching strategy

### Key Bottlenecks
1. **No server-side aggregation** → Large data transfer
2. **Client-side processing** → Slow rendering
3. **Inconsistent product filtering** → Confusing UX
4. **Date handling issues** → Potential bugs

### Next Steps
Consider implementing server-side aggregation using PostgreSQL RPC functions or materialized views for better performance and data consistency.
