#!/bin/bash
# Bash script để setup và deploy Cloud Run service
# Chạy script này sau khi đã cài đặt gcloud CLI

echo "🚀 Cloud Run Setup Script"
echo ""

# Kiểm tra xem gcloud đã được cài đặt chưa
echo "📋 Kiểm tra gcloud CLI..."
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI chưa được cài đặt!"
    echo "Vui lòng cài đặt gcloud CLI trước: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI đã được cài đặt"
gcloud --version | head -n 1
echo ""

# Bước 1: Đăng nhập
echo "🔐 Bước 1: Đăng nhập vào Google Cloud..."
read -p "Bạn đã đăng nhập chưa? (y/n) " login
if [[ ! $login =~ ^[Yy]$ ]]; then
    echo "Đang mở trình duyệt để đăng nhập..."
    gcloud auth login
fi

echo ""

# Bước 2: Chọn project
echo "📁 Bước 2: Chọn Google Cloud Project..."
current_project=$(gcloud config get-value project 2>/dev/null)
if [ -n "$current_project" ]; then
    echo "Project hiện tại: $current_project"
    read -p "Bạn có muốn đổi project không? (y/n) " change_project
    if [[ $change_project =~ ^[Yy]$ ]]; then
        read -p "Nhập Project ID: " project_id
        gcloud config set project "$project_id"
    fi
else
    read -p "Nhập Project ID của bạn: " project_id
    gcloud config set project "$project_id"
fi

project_id=$(gcloud config get-value project)
echo "✅ Đã chọn project: $project_id"
echo ""

# Bước 3: Enable APIs
echo "🔧 Bước 3: Enable các API cần thiết..."
echo "Đang enable Cloud Run API..."
gcloud services enable run.googleapis.com --quiet

echo "Đang enable Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com --quiet

echo "✅ Đã enable các API cần thiết"
echo ""

# Bước 4: Nhập environment variables
echo "⚙️  Bước 4: Cấu hình Environment Variables..."
echo "Vui lòng nhập các thông tin sau:"

read -p "Supabase URL (ví dụ: https://xxx.supabase.co): " supabase_url
read -sp "Supabase Anon Key: " supabase_key
echo ""
read -p "Nhanh.vn App ID: " app_id
read -p "Nhanh.vn Business ID: " business_id
read -sp "Nhanh.vn Access Token: " access_token
echo ""
read -p "Số đơn xử lý mỗi lần (mặc định: 10): " process_limit
process_limit=${process_limit:-10}

echo ""

# Bước 5: Deploy Cloud Run
echo "🚀 Bước 5: Deploy Cloud Run Service..."
echo "Đang deploy order-processor..."

gcloud run deploy order-processor \
    --source . \
    --region asia-southeast1 \
    --allow-unauthenticated \
    --set-env-vars="SUPABASE_URL=$supabase_url,SUPABASE_KEY=$supabase_key,APP_ID=$app_id,BUSINESS_ID=$business_id,ACCESS_TOKEN=$access_token,PROCESS_LIMIT=$process_limit" \
    --memory=512Mi \
    --timeout=300 \
    --max-instances=10

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy thành công!"
    
    # Lấy service URL
    service_url=$(gcloud run services describe order-processor --region asia-southeast1 --format 'value(status.url)')
    echo "Service URL: $service_url"
    
    echo ""
    echo "📅 Bước 6: Setup Cloud Scheduler..."
    read -p "Bạn có muốn setup Cloud Scheduler ngay không? (y/n) " setup_scheduler
    
    if [[ $setup_scheduler =~ ^[Yy]$ ]]; then
        echo "Đang tạo Cloud Scheduler job..."
        gcloud scheduler jobs create http order-processor-scheduler \
            --location=asia-southeast1 \
            --schedule="*/1 * * * *" \
            --uri="$service_url/process_order" \
            --http-method=GET \
            --time-zone="Asia/Ho_Chi_Minh"
        
        if [ $? -eq 0 ]; then
            echo "✅ Đã tạo Cloud Scheduler job thành công!"
            echo "Job sẽ chạy mỗi phút để xử lý đơn hàng"
        else
            echo "⚠️  Không thể tạo Cloud Scheduler job. Bạn có thể tạo thủ công sau."
        fi
    else
        echo "Bạn có thể tạo Cloud Scheduler job sau bằng lệnh:"
        echo "gcloud scheduler jobs create http order-processor-scheduler --location=asia-southeast1 --schedule=\"*/1 * * * *\" --uri=\"$service_url/process_order\" --http-method=GET --time-zone=\"Asia/Ho_Chi_Minh\""
    fi
    
    echo ""
    echo "🎉 Hoàn tất setup!"
    echo "Service URL: $service_url"
    echo "Bạn có thể test bằng cách gọi: curl $service_url/process_order"
else
    echo ""
    echo "❌ Deploy thất bại. Vui lòng kiểm tra lại."
fi

