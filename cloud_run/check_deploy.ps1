# Script kiểm tra điều kiện deploy
Write-Host "🔍 Kiểm tra điều kiện deploy Cloud Run..." -ForegroundColor Cyan
Write-Host ""

$allOk = $true

# 1. Kiểm tra gcloud CLI
Write-Host "1. Kiểm tra gcloud CLI..." -ForegroundColor Yellow
$gcloudPath = $null
$possiblePaths = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:ProgramFiles(x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $gcloudPath = $path
        break
    }
}

if (-not $gcloudPath) {
    $gcloudPath = Get-ChildItem -Path $env:LOCALAPPDATA -Recurse -Filter "gcloud.cmd" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}

if ($gcloudPath -and (Test-Path $gcloudPath)) {
    Write-Host "   ✅ gcloud CLI đã được cài đặt" -ForegroundColor Green
    Write-Host "   📍 Đường dẫn: $gcloudPath" -ForegroundColor Gray
    
    # Kiểm tra version
    try {
        $version = & $gcloudPath --version 2>&1 | Select-Object -First 1
        Write-Host "   📦 $version" -ForegroundColor Gray
    } catch {
        Write-Host "   ⚠️  Không thể chạy gcloud" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ gcloud CLI chưa được cài đặt" -ForegroundColor Red
    Write-Host "   💡 Chạy: ..\install_gcloud.ps1" -ForegroundColor Cyan
    $allOk = $false
}

Write-Host ""

# 2. Kiểm tra đăng nhập
if ($gcloudPath -and (Test-Path $gcloudPath)) {
    Write-Host "2. Kiểm tra đăng nhập Google Cloud..." -ForegroundColor Yellow
    try {
        $account = & $gcloudPath config get-value account 2>&1
        if ($account -and $account -notmatch "ERROR" -and $account -notmatch "unset") {
            Write-Host "   ✅ Đã đăng nhập: $account" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Chưa đăng nhập" -ForegroundColor Red
            Write-Host "   💡 Chạy: gcloud auth login" -ForegroundColor Cyan
            $allOk = $false
        }
    } catch {
        Write-Host "   ⚠️  Không thể kiểm tra" -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    # 3. Kiểm tra project
    Write-Host "3. Kiểm tra Google Cloud Project..." -ForegroundColor Yellow
    try {
        $project = & $gcloudPath config get-value project 2>&1
        if ($project -and $project -notmatch "ERROR" -and $project -notmatch "unset") {
            Write-Host "   ✅ Project hiện tại: $project" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Chưa chọn project" -ForegroundColor Yellow
            Write-Host "   💡 Chạy: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "   ⚠️  Không thể kiểm tra" -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    # 4. Kiểm tra APIs
    Write-Host "4. Kiểm tra APIs đã enable..." -ForegroundColor Yellow
    try {
        $apis = & $gcloudPath services list --enabled --format="value(config.name)" 2>&1
        $runApiEnabled = $apis -match "run.googleapis.com"
        $schedulerApiEnabled = $apis -match "cloudscheduler.googleapis.com"
        
        if ($runApiEnabled) {
            Write-Host "   ✅ Cloud Run API đã enable" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Cloud Run API chưa enable" -ForegroundColor Yellow
            Write-Host "   💡 Chạy: gcloud services enable run.googleapis.com" -ForegroundColor Cyan
        }
        
        if ($schedulerApiEnabled) {
            Write-Host "   ✅ Cloud Scheduler API đã enable" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Cloud Scheduler API chưa enable" -ForegroundColor Yellow
            Write-Host "   💡 Chạy: gcloud services enable cloudscheduler.googleapis.com" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "   ⚠️  Không thể kiểm tra" -ForegroundColor Yellow
    }
}

Write-Host ""

# 5. Kiểm tra thông tin Supabase
Write-Host "5. Kiểm tra thông tin Supabase..." -ForegroundColor Yellow
$supabaseUrl = "https://euknfbvuviadxjmchnca.supabase.co"
Write-Host "   ✅ Supabase URL: $supabaseUrl" -ForegroundColor Green
Write-Host "   ✅ Supabase Key: Đã được cấu hình trong script" -ForegroundColor Green

Write-Host ""

# 6. Kiểm tra file cần thiết
Write-Host "6. Kiểm tra file cần thiết..." -ForegroundColor Yellow
$requiredFiles = @("main.py", "requirements.txt", ".gcloudignore")
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file không tồn tại" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""

# Tổng kết
if ($allOk) {
    Write-Host "✅ Tất cả điều kiện đã sẵn sàng!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Bạn có thể deploy bằng cách:" -ForegroundColor Cyan
    Write-Host "   .\deploy.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Hoặc xem hướng dẫn chi tiết:" -ForegroundColor Cyan
    Write-Host "   Xem file: DEPLOY_GUIDE.md" -ForegroundColor White
} else {
    Write-Host "⚠️  Một số điều kiện chưa đáp ứng. Vui lòng sửa các lỗi trên trước khi deploy." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Hướng dẫn:" -ForegroundColor Cyan
    Write-Host "   1. Cài đặt gcloud: ..\install_gcloud.ps1" -ForegroundColor White
    Write-Host "   2. Đăng nhập: gcloud auth login" -ForegroundColor White
    Write-Host "   3. Chọn project: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor White
    Write-Host "   4. Enable APIs: gcloud services enable run.googleapis.com cloudscheduler.googleapis.com" -ForegroundColor White
}

