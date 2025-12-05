# Hướng Dẫn Cấu Hình Environment Variables

## Tạo File .env

Tạo file `.env` ở thư mục gốc của dự án với nội dung sau:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://euknfbvuviadxjmchnca.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a25mYnZ1dmlhZHhqbWNobmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzk0ODQsImV4cCI6MjA3OTIxNTQ4NH0.v49vfBB3nLZHbv1_6-l771DLCVfW4p9lXyJNcxl2Urw

# Nhanh.vn API Configuration
# Lấy từ: https://pos.open.nhanh.vn
VITE_NHANH_APP_ID=your_app_id_here
VITE_NHANH_BUSINESS_ID=your_business_id_here
VITE_NHANH_ACCESS_TOKEN=your_access_token_here
```

## Thông Tin Supabase

- **Project**: `financial-management-system`
- **Project ID**: `euknfbvuviadxjmchnca`
- **URL**: `https://euknfbvuviadxjmchnca.supabase.co`
- **Anon Key**: Đã được cung cấp ở trên

## Lấy Thông Tin Nhanh.vn API

1. Đăng nhập vào https://pos.open.nhanh.vn
2. Vào phần Settings/API để lấy:
   - `APP_ID`
   - `BUSINESS_ID`
   - `ACCESS_TOKEN`

## Lưu Ý

- File `.env` đã được thêm vào `.gitignore` để không commit lên Git
- Vite chỉ expose các biến có prefix `VITE_`
- Sau khi tạo file `.env`, cần restart dev server để áp dụng thay đổi

