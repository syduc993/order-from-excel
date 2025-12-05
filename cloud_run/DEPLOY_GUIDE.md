# Hướng Dẫn Deploy Cloud Run Service

## 🚀 Deploy Nhanh (Khuyến nghị)

### Bước 1: Cài đặt Google Cloud CLI

Nếu chưa có gcloud CLI, chạy:

```powershell
# Từ thư mục gốc của project
.\install_gcloud.ps1
```

Hoặc cài đặt thủ công từ: https://cloud.google.com/sdk/docs/install

### Bước 2: Deploy tự động

```powershell
cd cloud_run

# Deploy với thông tin Supabase đã có sẵn
# Chỉ cần nhập: Project ID, App ID, Business ID, Access Token
.\deploy.ps1
```

Script sẽ tự động:
- ✅ Kiểm tra và đăng nhập Google Cloud
- ✅ Enable các API cần thiết
- ✅ Deploy Cloud Run service
- ✅ Setup Cloud Scheduler (chạy mỗi phút)

### Bước 3: Nhập thông tin khi được hỏi

Khi chạy script, bạn sẽ cần nhập:
1. **Google Cloud Project ID**: ID của project trên Google Cloud
2. **Nhanh.vn App ID**: App ID từ Nhanh.vn API
3. **Nhanh.vn Business ID**: Business ID từ Nhanh.vn API
4. **Nhanh.vn Access Token**: Access token từ Nhanh.vn API

**Thông tin Supabase đã được cấu hình sẵn:**
- URL: `https://euknfbvuviadxjmchnca.supabase.co`
- Anon Key: Đã được cấu hình trong script

---

## 📋 Deploy với Tham Số

Nếu muốn chỉ định tham số trực tiếp:

```powershell
.\deploy.ps1 `
    -ProjectId "your-project-id" `
    -AppId "your-app-id" `
    -BusinessId "your-business-id" `
    -AccessToken "your-access-token" `
    -ProcessLimit "10"
```

---

## 🔧 Deploy Thủ Công

### Bước 1: Đăng nhập Google Cloud

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Bước 2: Enable APIs

```powershell
gcloud services enable run.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
```

### Bước 3: Deploy Cloud Run

```powershell
cd cloud_run

gcloud run deploy order-processor `
    --source . `
    --region asia-southeast1 `
    --allow-unauthenticated `
    --set-env-vars="SUPABASE_URL=https://euknfbvuviadxjmchnca.supabase.co,SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a25mYnZ1dmlhZHhqbWNobmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzk0ODQsImV4cCI6MjA3OTIxNTQ4NH0.v49vfBB3nLZHbv1_6-l771DLCVfW4p9lXyJNcxl2Urw,APP_ID=YOUR_APP_ID,BUSINESS_ID=YOUR_BUSINESS_ID,ACCESS_TOKEN=YOUR_ACCESS_TOKEN,PROCESS_LIMIT=10" `
    --memory=512Mi `
    --timeout=300 `
    --max-instances=10
```

### Bước 4: Setup Cloud Scheduler

```powershell
# Lấy service URL
$serviceUrl = gcloud run services describe order-processor --region asia-southeast1 --format 'value(status.url)'

# Tạo scheduler job
gcloud scheduler jobs create http order-processor-scheduler `
    --location=asia-southeast1 `
    --schedule="*/1 * * * *" `
    --uri="$serviceUrl/process_order" `
    --http-method=GET `
    --time-zone="Asia/Ho_Chi_Minh"
```

---

## ✅ Kiểm Tra Sau Khi Deploy

### Test service

```powershell
# Lấy service URL
$serviceUrl = gcloud run services describe order-processor --region asia-southeast1 --format 'value(status.url)'

# Test
curl $serviceUrl/process_order
```

### Xem logs

```powershell
gcloud run services logs read order-processor --region asia-southeast1
```

### Kiểm tra Cloud Scheduler

```powershell
# Xem danh sách jobs
gcloud scheduler jobs list --location=asia-southeast1

# Xem chi tiết job
gcloud scheduler jobs describe order-processor-scheduler --location=asia-southeast1
```

---

## 🔄 Update Service

Khi cần cập nhật code:

```powershell
cd cloud_run
.\deploy.ps1
```

Hoặc:

```powershell
gcloud run deploy order-processor --source . --region asia-southeast1
```

---

## ⚠️ Lưu Ý

1. **Environment Variables**: Các biến môi trường được lưu trong Cloud Run service. Khi update, cần set lại nếu thay đổi.

2. **Cost**: Cloud Run chỉ tính phí khi chạy. Với 1 request/phút, chi phí rất thấp (~$0.01-0.05/tháng).

3. **Rate Limiting**: Điều chỉnh `PROCESS_LIMIT` nếu API Nhanh.vn có giới hạn.

4. **Timeout**: Mặc định 300 giây. Nếu xử lý nhiều đơn, có thể cần tăng.

---

## 🆘 Troubleshooting

### Lỗi: "gcloud not found"
→ Cài đặt gcloud CLI: `.\install_gcloud.ps1`

### Lỗi: "Permission denied"
→ Đảm bảo đã đăng nhập: `gcloud auth login`
→ Kiểm tra quyền trong Google Cloud Console

### Lỗi: "API not enabled"
→ Enable APIs: `gcloud services enable run.googleapis.com cloudscheduler.googleapis.com`

### Lỗi: "Project not found"
→ Kiểm tra Project ID: `gcloud config get-value project`
→ Set project: `gcloud config set project YOUR_PROJECT_ID`

