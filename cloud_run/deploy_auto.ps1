# Script deploy tự động - Đọc từ .env hoặc hỏi user
param(
    [switch]$SkipScheduler = $false
)

Write-Host "🚀 Cloud Run Auto Deploy Script" -ForegroundColor Cyan
Write-Host ""

# Đọc từ .env nếu có
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
$envVars = @{}

if (Test-Path $envFile) {
    Write-Host "📄 Đang đọc file .env..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            $envVars[$key] = $value
        }
    }
    Write-Host "✅ Đã đọc file .env" -ForegroundColor Green
} else {
    Write-Host "⚠️  File .env không tồn tại, sẽ hỏi thông tin khi cần" -ForegroundColor Yellow
}

# Lấy thông tin từ .env hoặc biến môi trường
function Get-EnvValue {
    param([string]$key, [string]$default = "")
    if ($envVars.ContainsKey($key)) {
        return $envVars[$key]
    }
    $envValue = (Get-Item "env:$key" -ErrorAction SilentlyContinue).Value
    if ($envValue) {
        return $envValue
    }
    return $default
}

# Lấy thông tin
$supabaseUrl = Get-EnvValue "VITE_SUPABASE_URL" "https://euknfbvuviadxjmchnca.supabase.co"
$supabaseKey = Get-EnvValue "VITE_SUPABASE_ANON_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a25mYnZ1dmlhZHhqbWNobmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzk0ODQsImV4cCI6MjA3OTIxNTQ4NH0.v49vfBB3nLZHbv1_6-l771DLCVfW4p9lXyJNcxl2Urw"
$appId = Get-EnvValue "VITE_NHANH_APP_ID" ""
$businessId = Get-EnvValue "VITE_NHANH_BUSINESS_ID" ""
$accessToken = Get-EnvValue "VITE_NHANH_ACCESS_TOKEN" ""
$projectId = Get-EnvValue "GCLOUD_PROJECT_ID" ""
$processLimit = Get-EnvValue "PROCESS_LIMIT" "10"

# Hỏi thông tin nếu thiếu
if ([string]::IsNullOrWhiteSpace($appId)) {
    $appId = Read-Host "Nhập Nhanh.vn App ID"
}
if ([string]::IsNullOrWhiteSpace($businessId)) {
    $businessId = Read-Host "Nhập Nhanh.vn Business ID"
}
if ([string]::IsNullOrWhiteSpace($accessToken)) {
    $accessTokenSecure = Read-Host "Nhập Nhanh.vn Access Token" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($accessTokenSecure)
    $accessToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
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
        $currentPath = $env:PATH
        if ($currentPath -notlike "*$gcloudDir*") {
            $env:PATH = $gcloudDir + ";" + $currentPath
        }
        break
    }
}

if (-not $gcloudPath) {
    $gcloudPath = Get-ChildItem -Path $env:LOCALAPPDATA -Recurse -Filter "gcloud.cmd" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    if ($gcloudPath) {
        $gcloudDir = Split-Path $gcloudPath -Parent
        $currentPath = $env:PATH
        if ($currentPath -notlike "*$gcloudDir*") {
            $env:PATH = $gcloudDir + ";" + $currentPath
        }
    }
}

# Kiểm tra gcloud
if (-not $gcloudPath -or -not (Test-Path $gcloudPath)) {
    Write-Host "❌ gcloud CLI chưa được cài đặt!" -ForegroundColor Red
    Write-Host "💡 Đang cài đặt gcloud CLI..." -ForegroundColor Yellow
    $installScript = Join-Path (Split-Path $PSScriptRoot -Parent) "install_gcloud.ps1"
    if (Test-Path $installScript) {
        & $installScript
        Write-Host "⚠️  Vui lòng mở terminal mới và chạy lại script này" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "Vui lòng cài đặt gcloud CLI thủ công: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
        exit 1
    }
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
if ([string]::IsNullOrWhiteSpace($projectId)) {
    $currentProject = & $gcloudPath config get-value project 2>&1
    if ($currentProject -and $currentProject -notmatch "ERROR") {
        $projectId = $currentProject
        Write-Host "✅ Sử dụng project hiện tại: $projectId" -ForegroundColor Green
    } else {
        $projectId = Read-Host "Nhập Google Cloud Project ID"
        & $gcloudPath config set project $projectId
    }
} else {
    & $gcloudPath config set project $projectId
    Write-Host "✅ Đã chọn project: $projectId" -ForegroundColor Green
}

# Enable APIs
Write-Host ""
Write-Host "🔧 Enable các API cần thiết..." -ForegroundColor Yellow
& $gcloudPath services enable run.googleapis.com --quiet 2>&1 | Out-Null
& $gcloudPath services enable cloudscheduler.googleapis.com --quiet 2>&1 | Out-Null
Write-Host "✅ Đã enable các API" -ForegroundColor Green

Write-Host ""
Write-Host "📋 Thông tin cấu hình:" -ForegroundColor Cyan
Write-Host "  Project ID: $projectId" -ForegroundColor Gray
Write-Host "  Supabase URL: $supabaseUrl" -ForegroundColor Gray
Write-Host "  App ID: $appId" -ForegroundColor Gray
Write-Host "  Business ID: $businessId" -ForegroundColor Gray
Write-Host "  Process Limit: $processLimit" -ForegroundColor Gray
Write-Host ""

# Deploy Cloud Run
Write-Host "🚀 Đang deploy Cloud Run service..." -ForegroundColor Yellow
$envVarsString = "SUPABASE_URL=$supabaseUrl,SUPABASE_KEY=$supabaseKey,APP_ID=$appId,BUSINESS_ID=$businessId,ACCESS_TOKEN=$accessToken,PROCESS_LIMIT=$processLimit"

& $gcloudPath run deploy order-processor `
    --source . `
    --region asia-southeast1 `
    --allow-unauthenticated `
    --set-env-vars="$envVarsString" `
    --memory=512Mi `
    --timeout=300 `
    --max-instances=10 `
    --project=$projectId

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Deploy thất bại!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deploy thành công!" -ForegroundColor Green

# Lấy service URL
$serviceUrl = & $gcloudPath run services describe order-processor --region asia-southeast1 --format 'value(status.url)' --project=$projectId
Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan

# Setup Cloud Scheduler
if (-not $SkipScheduler) {
    Write-Host ""
    Write-Host "📅 Đang setup Cloud Scheduler..." -ForegroundColor Yellow
    
    # Kiểm tra xem job đã tồn tại chưa
    $existingJob = & $gcloudPath scheduler jobs describe order-processor-scheduler --location=asia-southeast1 --project=$projectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "⚠️  Job đã tồn tại. Đang cập nhật..." -ForegroundColor Yellow
        & $gcloudPath scheduler jobs update http order-processor-scheduler `
            --location=asia-southeast1 `
            --schedule="*/1 * * * *" `
            --uri="$serviceUrl/process_order" `
            --http-method=GET `
            --time-zone="Asia/Ho_Chi_Minh" `
            --project=$projectId
    } else {
        Write-Host "Đang tạo Cloud Scheduler job..." -ForegroundColor Gray
        & $gcloudPath scheduler jobs create http order-processor-scheduler `
            --location=asia-southeast1 `
            --schedule="*/1 * * * *" `
            --uri="$serviceUrl/process_order" `
            --http-method=GET `
            --time-zone="Asia/Ho_Chi_Minh" `
            --project=$projectId
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
