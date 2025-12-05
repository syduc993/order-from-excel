# Script deploy tu dong Cloud Run service
# Doc tu .env neu co, neu khong thi hoi user

param(
    [string]$ProjectId = "",
    [string]$SupabaseUrl = "https://euknfbvuviadxjmchnca.supabase.co",
    [string]$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a25mYnZ1dmlhZHhqbWNobmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzk0ODQsImV4cCI6MjA3OTIxNTQ4NH0.v49vfBB3nLZHbv1_6-l771DLCVfW4p9lXyJNcxl2Urw",
    [string]$AppId = "",
    [string]$BusinessId = "",
    [string]$AccessToken = "",
    [string]$ProcessLimit = "10",
    [switch]$SkipScheduler = $false
)

Write-Host "Cloud Run Deploy Script" -ForegroundColor Cyan
Write-Host ""

# Doc tu .env neu co
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
$envVars = @{}

if (Test-Path $envFile) {
    Write-Host "Dang doc file .env..." -ForegroundColor Yellow
    Get-Content $envFile -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            $envVars[$key] = $value
        }
    }
    Write-Host "Da doc file .env" -ForegroundColor Green
    
    # Lay thong tin tu .env neu chua co trong param
    if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or $SupabaseUrl -eq "https://euknfbvuviadxjmchnca.supabase.co") {
        if ($envVars.ContainsKey("VITE_SUPABASE_URL")) {
            $SupabaseUrl = $envVars["VITE_SUPABASE_URL"]
        }
    }
    if ([string]::IsNullOrWhiteSpace($SupabaseKey) -or $SupabaseKey -like "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9*") {
        if ($envVars.ContainsKey("VITE_SUPABASE_ANON_KEY")) {
            $SupabaseKey = $envVars["VITE_SUPABASE_ANON_KEY"]
        }
    }
    if ([string]::IsNullOrWhiteSpace($AppId)) {
        if ($envVars.ContainsKey("VITE_NHANH_APP_ID")) {
            $AppId = $envVars["VITE_NHANH_APP_ID"]
        }
    }
    if ([string]::IsNullOrWhiteSpace($BusinessId)) {
        if ($envVars.ContainsKey("VITE_NHANH_BUSINESS_ID")) {
            $BusinessId = $envVars["VITE_NHANH_BUSINESS_ID"]
        }
    }
    if ([string]::IsNullOrWhiteSpace($AccessToken)) {
        if ($envVars.ContainsKey("VITE_NHANH_ACCESS_TOKEN")) {
            $AccessToken = $envVars["VITE_NHANH_ACCESS_TOKEN"]
        }
    }
    if ([string]::IsNullOrWhiteSpace($ProjectId)) {
        if ($envVars.ContainsKey("GCLOUD_PROJECT_ID")) {
            $ProjectId = $envVars["GCLOUD_PROJECT_ID"]
        }
    }
} else {
    Write-Host "File .env khong ton tai, se hoi thong tin khi can" -ForegroundColor Yellow
}

# Refresh PATH để tìm gcloud
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')

# Tìm gcloud
$gcloudPath = $null
$possiblePaths = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:ProgramFiles(x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $gcloudPath = $path
        $gcloudDir = Split-Path $gcloudPath -Parent
        if ($env:PATH -notlike "*$gcloudDir*") {
            $env:PATH = "$gcloudDir;$env:PATH"
        }
        break
    }
}

if (-not $gcloudPath) {
    $gcloudPath = Get-ChildItem -Path $env:LOCALAPPDATA -Recurse -Filter "gcloud.cmd" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    if ($gcloudPath) {
        $gcloudDir = Split-Path $gcloudPath -Parent
        if ($env:PATH -notlike "*$gcloudDir*") {
            $env:PATH = "$gcloudDir;$env:PATH"
        }
    }
}

# Kiểm tra gcloud
if (-not $gcloudPath -or -not (Test-Path $gcloudPath)) {
    Write-Host "❌ gcloud CLI chưa được cài đặt!" -ForegroundColor Red
    Write-Host "Vui lòng chạy: .\install_gcloud.ps1 hoặc cài đặt thủ công" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Tìm thấy gcloud CLI" -ForegroundColor Green

# Kiểm tra đăng nhập
Write-Host "🔐 Kiểm tra đăng nhập Google Cloud..." -ForegroundColor Yellow
$account = & $gcloudPath config get-value account 2>&1
if (-not $account -or $account -match "ERROR" -or $account -match "unset") {
    Write-Host "⚠️  Chưa đăng nhập. Đang mở trình duyệt..." -ForegroundColor Yellow
    & $gcloudPath auth login
}

# Chọn project
if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    $currentProject = & $gcloudPath config get-value project 2>&1
    if ($currentProject -and $currentProject -notmatch "ERROR") {
        $ProjectId = $currentProject
        Write-Host "✅ Sử dụng project hiện tại: $ProjectId" -ForegroundColor Green
    } else {
        $ProjectId = Read-Host "Nhập Google Cloud Project ID"
        & $gcloudPath config set project $ProjectId
    }
} else {
    & $gcloudPath config set project $ProjectId
    Write-Host "✅ Đã chọn project: $ProjectId" -ForegroundColor Green
}

# Enable APIs
Write-Host ""
Write-Host "🔧 Enable các API cần thiết..." -ForegroundColor Yellow
& $gcloudPath services enable run.googleapis.com --quiet 2>&1 | Out-Null
& $gcloudPath services enable cloudscheduler.googleapis.com --quiet 2>&1 | Out-Null
Write-Host "✅ Đã enable các API" -ForegroundColor Green

# Nhap thong tin Nhanh.vn neu chua co
if ([string]::IsNullOrWhiteSpace($AppId)) {
    $AppId = Read-Host "Nhap Nhanh.vn App ID"
}
if ([string]::IsNullOrWhiteSpace($BusinessId)) {
    $BusinessId = Read-Host "Nhap Nhanh.vn Business ID"
}
if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    $AccessTokenSecure = Read-Host "Nhap Nhanh.vn Access Token" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($AccessTokenSecure)
    $AccessToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host ""
Write-Host "📋 Thông tin cấu hình:" -ForegroundColor Cyan
Write-Host "  Project ID: $ProjectId" -ForegroundColor Gray
Write-Host "  Supabase URL: $SupabaseUrl" -ForegroundColor Gray
Write-Host "  App ID: $AppId" -ForegroundColor Gray
Write-Host "  Business ID: $BusinessId" -ForegroundColor Gray
Write-Host "  Process Limit: $ProcessLimit" -ForegroundColor Gray
Write-Host ""

# Deploy Cloud Run
Write-Host "🚀 Đang deploy Cloud Run service..." -ForegroundColor Yellow
$envVars = "SUPABASE_URL=$SupabaseUrl,SUPABASE_KEY=$SupabaseKey,APP_ID=$AppId,BUSINESS_ID=$BusinessId,ACCESS_TOKEN=$AccessToken,PROCESS_LIMIT=$ProcessLimit"

& $gcloudPath run deploy order-processor `
    --source . `
    --region asia-southeast1 `
    --allow-unauthenticated `
    --set-env-vars="$envVars" `
    --memory=512Mi `
    --timeout=300 `
    --max-instances=10 `
    --project=$ProjectId

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Deploy thất bại!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deploy thành công!" -ForegroundColor Green

# Lấy service URL
$serviceUrl = & $gcloudPath run services describe order-processor --region asia-southeast1 --format 'value(status.url)' --project=$ProjectId
Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan

# Setup Cloud Scheduler
if (-not $SkipScheduler) {
    Write-Host ""
    Write-Host "📅 Đang setup Cloud Scheduler..." -ForegroundColor Yellow
    
    # Kiểm tra xem job đã tồn tại chưa
    $existingJob = & $gcloudPath scheduler jobs describe order-processor-scheduler --location=asia-southeast1 --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "⚠️  Job đã tồn tại. Đang cập nhật..." -ForegroundColor Yellow
        & $gcloudPath scheduler jobs update http order-processor-scheduler `
            --location=asia-southeast1 `
            --schedule="*/1 * * * *" `
            --uri="$serviceUrl/process_order" `
            --http-method=GET `
            --time-zone="Asia/Ho_Chi_Minh" `
            --project=$ProjectId
    } else {
        Write-Host "Đang tạo Cloud Scheduler job..." -ForegroundColor Gray
        & $gcloudPath scheduler jobs create http order-processor-scheduler `
            --location=asia-southeast1 `
            --schedule="*/1 * * * *" `
            --uri="$serviceUrl/process_order" `
            --http-method=GET `
            --time-zone="Asia/Ho_Chi_Minh" `
            --project=$ProjectId
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Đã setup Cloud Scheduler thành công!" -ForegroundColor Green
        Write-Host "Job sẽ chạy mỗi phút để xử lý đơn hàng" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Không thể setup Cloud Scheduler. Bạn có thể tạo thủ công sau." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Hoàn tất!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Thông tin service:" -ForegroundColor Cyan
Write-Host "  Service URL: $serviceUrl" -ForegroundColor Gray
Write-Host "  Test: curl $serviceUrl/process_order" -ForegroundColor Gray
Write-Host "  Xem logs: gcloud run services logs read order-processor --region asia-southeast1" -ForegroundColor Gray

