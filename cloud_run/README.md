# Cloud Run Service - Order Processor

Cloud Run function để tự động xử lý đơn hàng từ Supabase và gọi API Nhanh.vn.

## 🎯 Chức Năng

- Chạy mỗi phút thông qua Cloud Scheduler
- Lấy các đơn hàng `pending` đã đến giờ từ Supabase
- Gọi API Nhanh.vn để tạo đơn hàng
- Lưu kết quả vào bảng `order_results`
- Cập nhật status: `completed` hoặc `failed`

## 📋 Yêu Cầu

- Google Cloud Platform account
- Supabase project đã setup
- API credentials của Nhanh.vn (APP_ID, BUSINESS_ID, ACCESS_TOKEN)

## 🚀 Deploy

### Cách 1: Sử dụng Script Tự Động (Khuyến nghị) ⭐

Script sẽ tự động hóa toàn bộ quá trình deploy, giúp bạn tiết kiệm thời gian!

#### Windows (PowerShell):
```powershell
# 1. Cài đặt gcloud CLI (nếu chưa có)
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe

# 2. Sau khi cài đặt xong, mở PowerShell mới và chạy:
cd cloud_run
.\setup.ps1
```

#### Linux/Mac (Bash):
```bash
# 1. Cài đặt gcloud CLI (nếu chưa có)
# https://cloud.google.com/sdk/docs/install

# 2. Chạy script setup
cd cloud_run
chmod +x setup.sh
./setup.sh
```

**Script sẽ tự động:**
- ✅ Kiểm tra gcloud CLI đã cài đặt chưa
- ✅ Hướng dẫn đăng nhập Google Cloud
- ✅ Chọn project
- ✅ Enable các API cần thiết (Cloud Run, Cloud Scheduler)
- ✅ Nhập environment variables
- ✅ Deploy Cloud Run service
- ✅ Setup Cloud Scheduler (tùy chọn)

### Cách 2: Deploy Thủ Công

### Bước 1: Cài đặt Google Cloud SDK

```bash
# Windows PowerShell - Cài đặt gcloud CLI
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe

# Sau khi cài đặt, mở terminal mới và đăng nhập
gcloud auth login

# Chọn project
gcloud config set project YOUR_PROJECT_ID
```

### Bước 2: Deploy Cloud Run Service

```bash
cd cloud_run

# Deploy với environment variables
gcloud run deploy order-processor \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars="SUPABASE_URL=https://your-project.supabase.co,SUPABASE_KEY=your-anon-key,APP_ID=your-app-id,BUSINESS_ID=your-business-id,ACCESS_TOKEN=your-access-token,PROCESS_LIMIT=10" \
  --memory=512Mi \
  --timeout=300 \
  --max-instances=10
```

### Bước 3: Setup Cloud Scheduler

Tạo job chạy mỗi phút:

```bash
# Lấy URL của Cloud Run service
SERVICE_URL=$(gcloud run services describe order-processor --region asia-southeast1 --format 'value(status.url)')

# Tạo Cloud Scheduler job
gcloud scheduler jobs create http order-processor-scheduler \
  --location=asia-southeast1 \
  --schedule="*/1 * * * *" \
  --uri="$SERVICE_URL/process_order" \
  --http-method=GET \
  --time-zone="Asia/Ho_Chi_Minh"
```

## 🔧 Environment Variables

| Variable | Mô tả | Bắt buộc |
|----------|-------|----------|
| `SUPABASE_URL` | URL của Supabase project | ✅ |
| `SUPABASE_KEY` | Anon key của Supabase | ✅ |
| `APP_ID` | App ID của Nhanh.vn API | ✅ |
| `BUSINESS_ID` | Business ID của Nhanh.vn API | ✅ |
| `ACCESS_TOKEN` | Access token của Nhanh.vn API | ✅ |
| `PROCESS_LIMIT` | Số đơn xử lý mỗi lần (mặc định: 10) | ❌ |

## 📊 Monitoring

### Xem logs

```bash
gcloud run services logs read order-processor --region asia-southeast1
```

### Xem metrics

- Vào Google Cloud Console → Cloud Run → order-processor
- Xem metrics: Requests, Latency, Errors

## 🔍 Testing

### Test local (với functions-framework)

```bash
cd cloud_run
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-anon-key"
export APP_ID="your-app-id"
export BUSINESS_ID="your-business-id"
export ACCESS_TOKEN="your-access-token"

# Chạy local
functions-framework --target=process_order --port=8080
```

### Test với curl

```bash
curl http://localhost:8080/process_order
```

## ⚠️ Lưu Ý

1. **Rate Limiting**: API Nhanh.vn có thể có giới hạn số request/giây. Điều chỉnh `PROCESS_LIMIT` nếu cần.

2. **Error Handling**: Function sẽ tự động retry và log lỗi. Kiểm tra logs thường xuyên.

3. **Cost**: Cloud Run chỉ tính phí khi chạy. Với 1 request/phút, chi phí rất thấp (~$0.01-0.05/tháng).

4. **Timeout**: Mặc định timeout là 300 giây. Nếu xử lý nhiều đơn, có thể cần tăng timeout.

## 🔄 Update Service

```bash
cd cloud_run
gcloud run deploy order-processor \
  --source . \
  --region asia-southeast1
```

## 📝 API Response Format

```json
{
  "message": "Processed 5 orders",
  "status": "ok",
  "processed": 5,
  "success": 4,
  "failed": 1,
  "results": [
    {
      "order_id": 123,
      "order_index": 0,
      "status": "completed",
      "bill_id": 19201,
      "success": true
    }
  ]
}
```

