# PowerShell script để setup và deploy Cloud Run service
# Chạy script này sau khi đã cài đặt gcloud CLI

Write-Host "🚀 Cloud Run Setup Script" -ForegroundColor Cyan
Write-Host ""

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

# Kiểm tra xem gcloud đã được cài đặt chưa
Write-Host "📋 Kiểm tra gcloud CLI..." -ForegroundColor Yellow
if ($gcloudPath) {
    try {
        $gcloudVersion = & $gcloudPath --version 2>&1
        Write-Host "✅ gcloud CLI đã được cài đặt" -ForegroundColor Green
        Write-Host $gcloudVersion[0] -ForegroundColor Gray
        # Tạo function để dùng gcloud dễ hơn
        Set-Alias -Name gcloud -Value $gcloudPath -Scope Script -Force
    } catch {
        Write-Host "❌ Không thể chạy gcloud!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ gcloud CLI chưa được cài đặt!" -ForegroundColor Red
    Write-Host "Vui lòng chạy lệnh sau để cài đặt:" -ForegroundColor Yellow
    Write-Host '(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")' -ForegroundColor Cyan
    Write-Host '& $env:Temp\GoogleCloudSDKInstaller.exe' -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# Bước 1: Đăng nhập
Write-Host "🔐 Bước 1: Đăng nhập vào Google Cloud..." -ForegroundColor Yellow
$login = Read-Host "Bạn đã đăng nhập chưa? (y/n)"
if ($login -ne "y" -and $login -ne "Y") {
    Write-Host "Đang mở trình duyệt để đăng nhập..." -ForegroundColor Cyan
    & $gcloudPath auth login
}

Write-Host ""

# Bước 2: Chọn project
Write-Host "📁 Bước 2: Chọn Google Cloud Project..." -ForegroundColor Yellow
$currentProject = & $gcloudPath config get-value project 2>&1
if ($currentProject -and $currentProject -notmatch "ERROR") {
    Write-Host "Project hiện tại: $currentProject" -ForegroundColor Gray
    $changeProject = Read-Host "Bạn có muốn đổi project không? (y/n)"
    if ($changeProject -eq "y" -or $changeProject -eq "Y") {
        $projectId = Read-Host "Nhập Project ID"
        & $gcloudPath config set project $projectId
    }
} else {
    $projectId = Read-Host "Nhập Project ID của bạn"
    & $gcloudPath config set project $projectId
}

$projectId = & $gcloudPath config get-value project
Write-Host "✅ Đã chọn project: $projectId" -ForegroundColor Green

Write-Host ""

# Bước 3: Enable APIs
Write-Host "🔧 Bước 3: Enable các API cần thiết..." -ForegroundColor Yellow
Write-Host "Đang enable Cloud Run API..." -ForegroundColor Gray
& $gcloudPath services enable run.googleapis.com --quiet

Write-Host "Đang enable Cloud Scheduler API..." -ForegroundColor Gray
& $gcloudPath services enable cloudscheduler.googleapis.com --quiet

Write-Host "✅ Đã enable các API cần thiết" -ForegroundColor Green

Write-Host ""

# Bước 4: Nhập environment variables
Write-Host "⚙️  Bước 4: Cấu hình Environment Variables..." -ForegroundColor Yellow
Write-Host "Vui lòng nhập các thông tin sau:" -ForegroundColor Cyan

$supabaseUrl = Read-Host "Supabase URL (ví dụ: https://xxx.supabase.co)"
$supabaseKey = Read-Host "Supabase Anon Key" -AsSecureString
$appId = Read-Host "Nhanh.vn App ID"
$businessId = Read-Host "Nhanh.vn Business ID"
$accessToken = Read-Host "Nhanh.vn Access Token" -AsSecureString
$processLimit = Read-Host "Số đơn xử lý mỗi lần (mặc định: 10)" 
if ([string]::IsNullOrWhiteSpace($processLimit)) {
    $processLimit = "10"
}

# Convert SecureString to plain text
$supabaseKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($supabaseKey))
$accessTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($accessToken))

Write-Host ""

# Bước 5: Deploy Cloud Run
Write-Host "🚀 Bước 5: Deploy Cloud Run Service..." -ForegroundColor Yellow
Write-Host "Đang deploy order-processor..." -ForegroundColor Gray

$envVars = "SUPABASE_URL=$supabaseUrl,SUPABASE_KEY=$supabaseKeyPlain,APP_ID=$appId,BUSINESS_ID=$businessId,ACCESS_TOKEN=$accessTokenPlain,PROCESS_LIMIT=$processLimit"

& $gcloudPath run deploy order-processor `
    --source . `
    --region asia-southeast1 `
    --allow-unauthenticated `
    --set-env-vars="$envVars" `
    --memory=512Mi `
    --timeout=300 `
    --max-instances=10

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deploy thành công!" -ForegroundColor Green
    
    # Lấy service URL
    $serviceUrl = & $gcloudPath run services describe order-processor --region asia-southeast1 --format 'value(status.url)'
    Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "📅 Bước 6: Setup Cloud Scheduler..." -ForegroundColor Yellow
    $setupScheduler = Read-Host "Bạn có muốn setup Cloud Scheduler ngay không? (y/n)"
    
    if ($setupScheduler -eq "y" -or $setupScheduler -eq "Y") {
        Write-Host "Đang tạo Cloud Scheduler job..." -ForegroundColor Gray
        & $gcloudPath scheduler jobs create http order-processor-scheduler `
            --location=asia-southeast1 `
            --schedule="*/1 * * * *" `
            --uri="$serviceUrl/process_order" `
            --http-method=GET `
            --time-zone="Asia/Ho_Chi_Minh"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Đã tạo Cloud Scheduler job thành công!" -ForegroundColor Green
            Write-Host "Job sẽ chạy mỗi phút để xử lý đơn hàng" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  Không thể tạo Cloud Scheduler job. Bạn có thể tạo thủ công sau." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Bạn có thể tạo Cloud Scheduler job sau bằng lệnh:" -ForegroundColor Yellow
        Write-Host "gcloud scheduler jobs create http order-processor-scheduler --location=asia-southeast1 --schedule=`"*/1 * * * *`" --uri=`"$serviceUrl/process_order`" --http-method=GET --time-zone=`"Asia/Ho_Chi_Minh`"" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "🎉 Hoàn tất setup!" -ForegroundColor Green
    Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan
    Write-Host "Bạn có thể test bằng cách gọi: curl $serviceUrl/process_order" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Deploy thất bại. Vui lòng kiểm tra lại." -ForegroundColor Red
}

