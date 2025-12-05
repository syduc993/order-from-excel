# Order From Excel - Hệ Thống Tạo Đơn Hàng Tự Động

Ứng dụng web để tự động tạo đơn hàng từ danh sách khách hàng và sản phẩm, tích hợp với API Nhanh.vn V3 và Supabase.

## 🚀 Tính Năng

- ✅ **Upload Excel Files**: Tải file danh sách khách hàng (DSKH) và sản phẩm (DSSP)
- ✅ **Tạo Đơn Hàng Random**: Tự động tạo đơn hàng với nhiều sản phẩm (1-5 sản phẩm/đơn)
- ✅ **Phân Bổ Thời Gian Thông Minh**: Phân bổ đơn hàng theo giờ (8h30-22h45, cao điểm/thấp, cuối tuần)
- ✅ **Lưu Vào Supabase**: Lưu đơn hàng vào database với batch management
- ✅ **Điều Chỉnh Linh Hoạt**: Điều chỉnh số lượng đơn hàng từ một ngày cụ thể trở đi
- ✅ **Xử Lý Tự Động**: Cloud Run tự động xử lý đơn hàng theo lịch trình
- ✅ **Xuất Excel**: Hỗ trợ xuất file Excel (backward compatibility)

## 📋 Yêu Cầu

- Node.js 18+ và npm/yarn/bun
- Supabase project (hoặc có thể tạo mới)
- Google Cloud Platform account (cho Cloud Run - tùy chọn)
- API credentials của Nhanh.vn (APP_ID, BUSINESS_ID, ACCESS_TOKEN)

## 🛠️ Cài Đặt

### 1. Clone Repository

```bash
git clone <repository-url>
cd order-from-excel
```

### 2. Cài Đặt Dependencies

```bash
npm install
# hoặc
yarn install
# hoặc
bun install
```

### 3. Cấu Hình Environment Variables

Tạo file `.env` trong thư mục gốc:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Nhanh.vn API (optional - có thể nhập trong UI)
VITE_NHANH_APP_ID=your-app-id
VITE_NHANH_BUSINESS_ID=your-business-id
VITE_NHANH_ACCESS_TOKEN=your-access-token
```

Xem file `.env.example` để biết thêm chi tiết.

### 4. Chạy Development Server

```bash
npm run dev
# hoặc
yarn dev
# hoặc
bun dev
```

Mở trình duyệt tại `http://localhost:5173`

## 📖 Hướng Dẫn Sử Dụng

### Bước 0: Test API (Khuyến nghị)

Trước khi sử dụng, nên test API để đảm bảo credentials hợp lệ:

```bash
# Windows
.\test_api.ps1

# Linux/Mac
chmod +x test_api.sh
./test_api.sh
```

Xem hướng dẫn chi tiết tại [test_api.md](test_api.md)

### Bước 1: Chuẩn Bị File Excel

#### File Danh Sách Khách Hàng (DSKH)
- Sheet tên: `DSKH`
- Các cột bắt buộc:
  - `ID`: ID khách hàng (số nguyên dương)
  - `Tên khách hàng`: Tên khách hàng
  - `Số điện thoại` hoặc `SĐT`: Số điện thoại

#### File Danh Sách Sản Phẩm (DSSP)
- Sheet tên: `DSSP`
- Các cột bắt buộc:
  - `ID`: ID sản phẩm (số nguyên dương)
  - `Tên hàng`: Tên sản phẩm
  - `Số lượng bán lẻ`: Số lượng
  - `Giá bán lẻ (Có VAT)`: Giá sản phẩm

### Bước 2: Tạo Đơn Hàng

1. **Chọn Chế Độ Xuất**:
   - **Xuất Excel**: Xuất file Excel (cần file template)
   - **Lưu vào Supabase**: Lưu vào database để xử lý tự động

2. **Nếu chọn "Lưu vào Supabase"**:
   - Nhập cấu hình Supabase (URL, Anon Key) - có thể load từ `.env`
   - Chọn khoảng ngày (startDate, endDate)
   - Nhập tổng số đơn hàng muốn tạo
   - Click "Lưu Vào Supabase"

3. **Hệ thống sẽ tự động**:
   - Tạo batch ID
   - Random đơn hàng với nhiều sản phẩm (1-5 sản phẩm/đơn, tổng 300k-1tr VNĐ)
   - Phân bổ thời gian theo giờ (8h30-22h45, cao điểm/thấp, cuối tuần)
   - Lưu vào Supabase với status `pending`

### Bước 3: Điều Chỉnh Đơn Hàng (Tùy chọn)

1. Nhập Batch ID
2. Click "Xem Thống Kê" để xem trạng thái batch
3. Chọn ngày bắt đầu điều chỉnh
4. Nhập số lượng đơn mới cho khoảng ngày còn lại
5. Click "Điều Chỉnh Đơn Hàng"

**Lưu ý**: Chỉ hủy đơn `pending`, không ảnh hưởng đơn đã xử lý (`completed`/`failed`)

### Bước 4: Xử Lý Tự Động (Cloud Run)

Xem hướng dẫn chi tiết tại [`cloud_run/README.md`](cloud_run/README.md)

## 🏗️ Kiến Trúc Hệ Thống

```
Frontend (React)
    ↓
Upload Excel → Parse → Generate Orders → Save to Supabase
                                    ↓
                            Supabase Database
                                    ↓
                            Cloud Run (mỗi phút)
                                    ↓
                            API Nhanh.vn V3
```

### Flow Xử Lý

1. **Frontend**: Upload Excel → Tạo đơn hàng random → Lưu vào Supabase
2. **Supabase**: Lưu trữ đơn hàng với `scheduled_time` và `status: pending`
3. **Cloud Run**: Chạy mỗi phút → Lấy đơn `pending` đã đến giờ → Gọi API Nhanh.vn
4. **Kết Quả**: Lưu vào `order_results`, cập nhật status `completed`/`failed`

## 📊 Logic Tạo Đơn Hàng

### Random Đơn Hàng
- Mỗi đơn có **1-5 sản phẩm** (random)
- Mỗi sản phẩm có số lượng **1-3** (random)
- Tổng giá trị đơn: **300,000 - 1,000,000 VNĐ**
- Phân bổ: 60% giá thấp, 30% giá trung, 10% giá cao

### Phân Bổ Thời Gian
- **Khung giờ chính**: 8h30 - 22h45 mỗi ngày
- **Giờ cao điểm** (nhiều đơn, weight = 3):
  - 10h-12h (trưa)
  - 16h-18h (chiều)
  - 20h-21h30 (tối)
- **Giờ thấp** (ít đơn, weight = 0.3):
  - 12h-14h (nghỉ trưa)
- **Giờ chuẩn bị đóng cửa** (weight = 0.8):
  - 21h30-22h45
- **Đơn muộn** (thực tế):
  - Một số ngày (khoảng 25%) có 1-2 đơn muộn
  - Giờ: 22h46 - 23h30
- **Cuối tuần**: Tăng 80% số lượng bill (Thứ 7, Chủ Nhật)

## 🔧 Cấu Hình

### Depot ID
- Hardcode: `215639` (theo yêu cầu API)
- Được định nghĩa trong `src/utils/constants.ts`

### Environment Variables
Xem file [`ENV_SETUP.md`](ENV_SETUP.md) để biết chi tiết về cấu hình environment variables.

## 📁 Cấu Trúc Dự Án

```
order-from-excel/
├── src/
│   ├── components/          # React components
│   ├── pages/               # Pages (Index, NotFound)
│   ├── services/            # API services (Supabase, Nhanh.vn)
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilities (validation, orderGenerator, timeDistribution)
│   └── config/              # Configuration (env)
├── cloud_run/               # Cloud Run service (Python)
│   ├── main.py              # Cloud Run function
│   ├── requirements.txt     # Python dependencies
│   └── README.md            # Cloud Run documentation
├── public/                  # Static files
└── README.md               # This file
```

## 🧪 Testing

### Test Validation
- Upload file với Customer ID/Product ID không hợp lệ → Kiểm tra validation
- Tạo đơn hàng với dữ liệu không hợp lệ → Kiểm tra error handling

### Test Supabase Integration
- Lưu đơn hàng vào Supabase → Kiểm tra batch ID và thống kê
- Điều chỉnh đơn hàng → Kiểm tra hủy đơn pending và tạo lại

### Test Cloud Run
Xem hướng dẫn tại [`cloud_run/README.md`](cloud_run/README.md)

## 📝 API Reference

### Nhanh.vn API V3

**Endpoint**: `POST https://pos.open.nhanh.vn/v3.0/bill/addretail`

**Headers**:
```
Authorization: {accessToken}
Content-Type: application/json
```

**Payload**:
```json
{
  "depotId": 215639,
  "customer": {
    "id": 83137
  },
  "products": [
    {
      "id": 1231279582,
      "quantity": 2
    }
  ]
}
```

## 🐛 Troubleshooting

### Lỗi Validation
- Kiểm tra Customer ID và Product ID phải là số nguyên dương
- Kiểm tra file Excel có đúng format không

### Lỗi Supabase
- Kiểm tra URL và Anon Key
- Kiểm tra kết nối internet
- Xem logs trong Supabase Dashboard

### Lỗi Cloud Run
- Kiểm tra environment variables
- Xem logs: `gcloud run services logs read order-processor --region asia-southeast1`
- Kiểm tra Cloud Scheduler job có chạy không

## 📚 Tài Liệu Tham Khảo

- [Kế Hoạch Triển Khai](KE_HOACH_API_V3.md)
- [Hướng Dẫn Setup Environment](ENV_SETUP.md)
- [Hướng Dẫn Test API](test_api.md)
- [Hướng Dẫn Deploy Cloud Run](cloud_run/README.md)
- [Hướng Dẫn Deploy Chi Tiết](cloud_run/DEPLOY_GUIDE.md)

## 🤝 Đóng Góp

Mọi đóng góp đều được chào đón! Vui lòng tạo issue hoặc pull request.

## 📄 License

MIT License

## 👤 Tác Giả

Dự án được phát triển để tự động hóa quy trình tạo đơn hàng cho Nhanh.vn.

---

**Lưu ý**: Đảm bảo bạn đã đọc và hiểu các yêu cầu về API credentials và cấu hình Supabase trước khi sử dụng.
