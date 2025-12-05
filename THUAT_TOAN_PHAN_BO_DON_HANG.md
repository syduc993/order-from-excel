# Thuật Toán Phân Bổ Đơn Hàng - Tài Liệu Chi Tiết

## 📋 Tổng Quan

Thuật toán hiện tại tạo đơn hàng từ danh sách sản phẩm và phân bổ chúng theo thời gian (ngày và giờ) với các yêu cầu:
- Phân bổ đều cho tất cả các ngày trong khoảng thời gian (26/11 - 30/11)
- Ưu tiên cuối tuần (tăng 80% số lượng đơn)
- Đảm bảo mỗi đơn có giá trị tối thiểu 300k
- Vét cạn số lượng sản phẩm còn lại thành các đơn nhỏ hơn

## 🔍 Vấn Đề Hiện Tại

**Vấn đề:** Thuật toán chỉ tạo đơn hàng đến ngày 28/11, không tạo cho ngày 29, 30.

**Nguyên nhân:** 
- Thuật toán tính số lượng đơn cho mỗi ngày TRƯỚC
- Sau đó tạo đơn hàng cho từng ngày theo thứ tự (26 → 27 → 28 → 29 → 30)
- Khi hết sản phẩm ở ngày 28, không còn sản phẩm để tạo cho ngày 29, 30

## 📝 Thuật Toán Hiện Tại (Chi Tiết)

### Bước 1: Tính Số Lượng Đơn Hàng Tổng

```typescript
const totalOrders = calculateTotalOrders(products);
// Tính từ: Tổng giá trị sản phẩm / Giá trị trung bình mỗi đơn (650k)
```

### Bước 2: Phân Bổ Số Lượng Đơn Cho Mỗi Ngày

**File:** `src/utils/timeDistribution.ts` - Hàm `calculateOrdersPerDay()`

```typescript
calculateOrdersPerDay(totalOrders, startDate, endDate)
```

**Logic:**
1. Tính weight cho mỗi ngày:
   - Ngày thường: weight = 1.0
   - Cuối tuần (Thứ 7, Chủ Nhật): weight = 1.8 (tăng 80%)

2. Tính tổng weight của tất cả các ngày

3. Phân bổ số lượng đơn cho mỗi ngày theo tỷ lệ weight:
   ```
   orderCount = Math.floor(totalOrders * (dayWeight / totalWeight))
   ```

4. Phân bổ số đơn còn lại (do làm tròn) vào các ngày có weight cao nhất

**Ví dụ với 5 ngày (26-30/11):**
- 26/11 (Thứ 4): weight = 1.0
- 27/11 (Thứ 5): weight = 1.0  
- 28/11 (Thứ 6): weight = 1.0
- 29/11 (Thứ 7): weight = 1.8
- 30/11 (Chủ Nhật): weight = 1.8
- Tổng weight = 6.6

Nếu totalOrders = 7500:
- 26/11: 7500 * (1.0/6.6) = 1136 đơn
- 27/11: 7500 * (1.0/6.6) = 1136 đơn
- 28/11: 7500 * (1.0/6.6) = 1136 đơn
- 29/11: 7500 * (1.8/6.6) = 2045 đơn
- 30/11: 7500 * (1.8/6.6) = 2045 đơn

### Bước 3: Tạo Đơn Hàng Cho Từng Ngày

**File:** `src/pages/Index.tsx` - Hàm `handleSupabaseExport()`

**Logic hiện tại (CÓ VẤN ĐỀ):**

```typescript
// Lặp qua từng ngày theo thứ tự
for (const dayPlan of ordersPerDay) {
  const { date, orderCount } = dayPlan;
  
  // Tạo đơn hàng cho ngày này
  while (ordersCreatedForDay < orderCount && currentInventory.some(p => p.quantity > 0)) {
    // Tạo đơn hàng từ inventory
    // Giảm inventory sau mỗi đơn
  }
}
```

**Vấn đề:**
- Tạo đơn hàng cho ngày 26 → hết một phần inventory
- Tạo đơn hàng cho ngày 27 → hết thêm inventory
- Tạo đơn hàng cho ngày 28 → **HẾT SẠCH INVENTORY**
- Ngày 29, 30: Không còn inventory → Không tạo được đơn nào

### Bước 4: Vét Sản Phẩm Còn Lại

**Logic:**
1. Lọc các sản phẩm còn thừa (`remainingProducts`)
2. Tính số lượng đơn vét cần tạo (mỗi đơn 50k-200k)
3. Phân bổ các đơn vét cho các ngày còn thiếu đơn
4. Tạo các đơn vét

**Vấn đề:** Nếu đã hết inventory ở bước 3, bước 4 không có gì để vét.

## 🐛 Phân Tích Vấn Đề

### Vấn Đề 1: Phân Bổ Số Lượng Đơn Không Phản Ánh Thực Tế

- `calculateOrdersPerDay()` tính số lượng đơn dựa trên `totalOrders` (ước tính)
- Nhưng số lượng đơn thực tế phụ thuộc vào inventory thực tế
- Nếu inventory không đủ, sẽ không tạo đủ số đơn đã tính

### Vấn Đề 2: Tạo Đơn Hàng Tuần Tự Theo Ngày

- Tạo hết đơn cho ngày 26 → hết inventory
- Không còn inventory cho ngày 27, 28, 29, 30

### Vấn Đề 3: Điều Kiện Dừng Sớm

```typescript
// Dòng 291: Dừng nếu giá trị còn lại < 100k
if (totalRemainingValue < 100000 && ordersCreatedForDay > 0) {
  break; // Dừng tạo đơn cho ngày này
}
```

Điều này có thể khiến dừng sớm ở ngày 28, không tạo đơn cho ngày 29, 30.

## 💡 Giải Pháp Đề Xuất

### Giải Pháp 1: Phân Bổ Inventory Trước, Sau Đó Mới Tạo Đơn

**Ý tưởng:**
1. Tính tổng giá trị inventory
2. Phân bổ giá trị inventory cho từng ngày theo weight
3. Tạo đơn hàng cho từng ngày từ phần inventory đã phân bổ

**Ưu điểm:**
- Đảm bảo mỗi ngày có đủ inventory
- Không bị hết inventory ở ngày đầu

**Nhược điểm:**
- Phức tạp hơn, cần quản lý inventory theo ngày

### Giải Pháp 2: Tạo Đơn Hàng Round-Robin

**Ý tưởng:**
1. Tính số lượng đơn cho mỗi ngày
2. Tạo đơn hàng theo kiểu round-robin: đơn 1 → ngày 26, đơn 2 → ngày 27, ..., đơn 6 → ngày 26 (lặp lại)
3. Đảm bảo phân bổ đều cho tất cả các ngày

**Ưu điểm:**
- Đơn giản, dễ implement
- Đảm bảo phân bổ đều

**Nhược điểm:**
- Có thể không tối ưu về mặt logic nghiệp vụ

### Giải Pháp 3: Tạo Đơn Hàng và Phân Bổ Sau

**Ý tưởng:**
1. Tạo tất cả đơn hàng trước (không gán ngày)
2. Sau đó phân bổ các đơn hàng cho các ngày theo weight và thời gian

**Ưu điểm:**
- Đảm bảo tạo đủ số lượng đơn
- Phân bổ linh hoạt

**Nhược điểm:**
- Cần tính toán lại scheduled_time sau khi phân bổ

## 📊 Flow Chart Hiện Tại

```
START
  ↓
Tính totalOrders từ products
  ↓
calculateOrdersPerDay() → ordersPerDay[]
  ↓
FOR mỗi ngày trong ordersPerDay:
  ├─ Lấy orderCount cho ngày này
  ├─ WHILE (ordersCreatedForDay < orderCount && còn inventory):
  │   ├─ Tạo đơn hàng từ inventory
  │   ├─ Giảm inventory
  │   └─ Tăng ordersCreatedForDay
  └─ NEXT ngày
  ↓
Vét sản phẩm còn lại (nếu có)
  ↓
END
```

## 🔧 Code Liên Quan

### File: `src/utils/timeDistribution.ts`

**Hàm `calculateOrdersPerDay()`:**
- Tính số lượng đơn cho mỗi ngày dựa trên weight
- Trả về: `Array<{ date: Date; orderCount: number }>`

**Hàm `distributeOrdersByTime()`:**
- Phân bổ thời gian cụ thể (giờ) cho các đơn hàng
- Tạo scheduled_time cho mỗi đơn

### File: `src/pages/Index.tsx`

**Hàm `handleSupabaseExport()`:**
- Dòng 237-242: Tính ordersPerDay
- Dòng 268-396: Tạo đơn hàng cho từng ngày (VẤN ĐỀ Ở ĐÂY)
- Dòng 398-537: Vét sản phẩm còn lại

## 🎯 Đề Xuất Sửa Đổi

### Cách 1: Round-Robin Distribution

Thay vì tạo đơn hàng cho từng ngày tuần tự, tạo đơn hàng và phân bổ round-robin:

```typescript
// Thay vì:
for (const dayPlan of ordersPerDay) {
  // Tạo hết đơn cho ngày này
}

// Nên:
let dayIndex = 0;
while (currentInventory.some(p => p.quantity > 0)) {
  const currentDay = ordersPerDay[dayIndex % ordersPerDay.length];
  // Tạo 1 đơn cho ngày này
  // dayIndex++
}
```

### Cách 2: Phân Bổ Inventory Trước

```typescript
// Tính tổng giá trị inventory
const totalInventoryValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);

// Phân bổ giá trị cho từng ngày
const inventoryPerDay = ordersPerDay.map(day => ({
  date: day.date,
  targetValue: totalInventoryValue * (day.orderCount / totalOrders)
}));

// Tạo đơn hàng cho từng ngày từ phần inventory đã phân bổ
```

### Cách 3: Tạo Đơn Hàng Trước, Phân Bổ Sau

```typescript
// 1. Tạo tất cả đơn hàng (không gán ngày)
const allOrders = [];
while (currentInventory.some(p => p.quantity > 0)) {
  // Tạo đơn hàng
  allOrders.push(order);
}

// 2. Phân bổ các đơn hàng cho các ngày
const ordersByDay = distributeOrdersToDays(allOrders, ordersPerDay);
```

## 📝 Ghi Chú

- Log hiện tại: `"Total remaining value < 300k, switching to sweep logic..."` xuất hiện ở ngày 28
- Điều này có nghĩa là ở ngày 28, giá trị inventory còn lại < 300k, nên dừng tạo đơn cho ngày này
- Nhưng vì tạo tuần tự, nên không còn inventory cho ngày 29, 30

## ✅ Checklist Sửa Lỗi

- [x] Thay đổi logic tạo đơn hàng từ tuần tự sang "Tạo đơn trước, phân bổ sau"
- [x] Đảm bảo mỗi ngày đều có đơn hàng (nếu còn inventory)
- [ ] Test với khoảng ngày 26-30/11
- [ ] Kiểm tra log để đảm bảo tạo đơn cho tất cả các ngày
- [x] Đảm bảo logic vét sản phẩm còn lại vẫn hoạt động

## 🔄 Logic Mới (Đã Sửa)

### Bước 1: Tính Số Lượng Đơn Hàng Tổng
- Tính `totalOrders` từ tổng giá trị sản phẩm

### Bước 2: Tính Phân Bổ Theo Ngày (Tham Khảo)
- Tính `ordersPerDay` để biết tỷ lệ phân bổ (ưu tiên cuối tuần)
- Chỉ dùng để tham khảo, không dùng để giới hạn số đơn

### Bước 3: Tạo TẤT CẢ Đơn Hàng Trước
- Tạo đơn hàng chính (300k-2M) cho đến khi hết inventory hoặc không thể tạo thêm
- Tạo đơn vét (50k-200k) từ sản phẩm còn lại
- **Chưa gán scheduledTime** - chỉ tạo order data

### Bước 4: Phân Bổ Đơn Hàng Cho Các Ngày

**Đơn hàng chính:**
- Phân bổ theo weight (ưu tiên cuối tuần và khung giờ cao điểm)
- Tạo time slots theo weight và phân bổ đơn hàng vào các slot

**Đơn vét:**
- Phân bổ vào khung giờ cao điểm cuối tuần
- Nếu không có cuối tuần → khung giờ cao điểm các ngày gần cuối tuần (Thứ 6, Thứ 7, Chủ Nhật)
- Nếu vẫn không có → phân bổ cho tất cả các ngày

### Bước 5: Sắp Xếp và Lưu
- Sắp xếp tất cả đơn hàng theo scheduledTime
- Lưu vào Supabase

## 📊 Flow Chart Mới

```
START
  ↓
Tính totalOrders từ products
  ↓
calculateOrdersPerDay() → ordersPerDay[] (tham khảo)
  ↓
Tạo TẤT CẢ đơn hàng (chưa gán thời gian):
  ├─ Đơn hàng chính (300k-2M)
  └─ Đơn vét (50k-200k)
  ↓
Phân bổ đơn hàng cho các ngày:
  ├─ Đơn chính → distributeOrdersToDays(isSweepOrder=false)
  │   └─ Phân bổ theo weight (ưu tiên cuối tuần + khung giờ cao điểm)
  └─ Đơn vét → distributeOrdersToDays(isSweepOrder=true)
      └─ Phân bổ vào khung giờ cao điểm cuối tuần (hoặc gần cuối tuần)
  ↓
Sắp xếp theo scheduledTime
  ↓
Lưu vào Supabase
  ↓
END
```

## 🎯 Ưu Điểm Logic Mới

1. **Đảm bảo phân bổ đều:** Tất cả đơn hàng được tạo trước, sau đó phân bổ → không bị hết inventory ở ngày đầu
2. **Ưu tiên cuối tuần:** Đơn hàng được phân bổ theo weight (cuối tuần tăng 80%)
3. **Ưu tiên khung giờ cao điểm:** Đơn hàng được phân bổ vào các khung giờ có weight cao
4. **Đơn vét thông minh:** Đơn vét được vứt vào khung giờ cao điểm cuối tuần hoặc gần cuối tuần

