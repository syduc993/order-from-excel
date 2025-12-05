# Kế hoạch Refactor Dự Án (Order From Excel)

Mục tiêu: Giảm kích thước file, tổ chức lại code theo chuẩn React best practices, giữ nguyên giao diện và chức năng.

## 1. Phân tích hiện trạng

Hiện tại, dự án có một số file quá lớn, vi phạm nguyên tắc "Single Responsibility" (Đơn nhiệm):

*   **`src/pages/Index.tsx` (~2088 dòng)**: Chứa quá nhiều logic xử lý: upload file, tính toán đơn hàng, tương tác Supabase, và render UI cho nhiều tab khác nhau.
*   **`src/pages/Dashboard.tsx` (~529 dòng)**: Chứa cả logic xử lý dữ liệu biểu đồ và các hàm helper định dạng ngày tháng/giờ.
*   **`src/services/supabase.ts` (~524 dòng)**: Class `SupabaseService` đang ôm đồm cả việc gọi API lẫn tính toán thống kê (histogram, revenue breakdown...).

## 2. Kế hoạch chi tiết

### Giai đoạn 1: Refactor `src/pages/Index.tsx` (Ưu tiên cao nhất)

Đây là file nặng nhất và cần tách nhỏ.

1.  **Tách Logic ra Custom Hooks**:
    *   Tạo `src/hooks/useOrderProcessing.ts`: Chứa logic của `handleSupabaseExport`, `adjustOrdersFromDate`, `handleProcess`.
    *   Tạo `src/hooks/useFileUpload.ts`: Chứa logic `handleCustomerFileUpload`, `handleProductFileUpload`.
    *   Tạo `src/hooks/useBatchStats.ts`: Chứa logic `loadBatchStats`.

2.  **Tách UI thành các Components nhỏ**:
    *   Tạo thư mục `src/features/order-generation/components/`.
    *   Tách tab "Tạo đơn hàng" thành `OrderGenerationTab.tsx`.
    *   Tách tab "Điều chỉnh đơn hàng" thành `OrderAdjustmentTab.tsx`.
    *   Tách tab "Danh sách đơn hàng" thành `OrderListTab.tsx`.

3.  **Di chuyển Utility Functions**:
    *   Chuyển `calculateTotalOrders`, `getStatusColor`, `getStatusText` sang `src/utils/orderUtils.ts`.

### Giai đoạn 2: Refactor `src/pages/Dashboard.tsx`

1.  **Tách Helper Functions**:
    *   Chuyển `convertHourToVietnam`, `normalizeDate`, `formatDateForDisplay` sang `src/utils/dateUtils.ts` hoặc `src/utils/dashboardUtils.ts`.

2.  **Tách Components Biểu đồ**:
    *   Tạo `src/components/dashboard/RevenueChart.tsx`.
    *   Tạo `src/components/dashboard/StatusCards.tsx`.

### Giai đoạn 3: Refactor `src/services/supabase.ts`

1.  **Tách Logic Tính toán**:
    *   Chuyển các hàm `calculateStatusBreakdown`, `calculateHistogramCount`, `calculateRevenueByDate`, v.v. ra khỏi class `SupabaseService`.
    *   Đưa chúng vào file `src/utils/statsUtils.ts` hoặc `src/services/statsService.ts` dưới dạng pure functions.
    *   `SupabaseService` chỉ nên chịu trách nhiệm gọi API và trả về dữ liệu thô.

### Giai đoạn 4: Cleanup & Cấu trúc thư mục

1.  **Review lại thư mục `src/types`**: Đảm bảo các interfaces được define rõ ràng và import/export hợp lý.
2.  **Xóa code thừa**: Kiểm tra và xóa các imports không dùng đến sau khi refactor.

## 3. Các bước thực hiện (Action Items)

- [ ] **Bước 1**: Tạo các file utils mới (`orderUtils.ts`, `dateUtils.ts`, `statsUtils.ts`).
- [ ] **Bước 2**: Refactor `SupabaseService` để dùng `statsUtils.ts`.
- [ ] **Bước 3**: Refactor `Dashboard.tsx` (tách utils và components).
- [ ] **Bước 4**: Refactor `Index.tsx` (tạo hooks và tách components con).
- [ ] **Bước 5**: Kiểm tra lại toàn bộ luồng (Regression Test) để đảm bảo không có lỗi phát sinh.
