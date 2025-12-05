# Simple deploy script - no special characters
param(
    [string]$ProjectId = "",
    [string]$AppId = "",
    [string]$BusinessId = "",
    [string]$AccessToken = ""
)

$SupabaseUrl = "https://euknfbvuviadxjmchnca.supabase.co"
$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a25mYnZ1dmlhZHhqbWNobmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzk0ODQsImV4cCI6MjA3OTIxNTQ4NH0.v49vfBB3nLZHbv1_6-l771DLCVfW4p9lXyJNcxl2Urw"
$ProcessLimit = "10"

# Read .env if exists
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (Test-Path $envFile) {
    Write-Host "Reading .env file..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            switch ($key) {
                "VITE_NHANH_APP_ID" { if ([string]::IsNullOrWhiteSpace($AppId)) { $AppId = $value } }
                "VITE_NHANH_BUSINESS_ID" { if ([string]::IsNullOrWhiteSpace($BusinessId)) { $BusinessId = $value } }
                "VITE_NHANH_ACCESS_TOKEN" { if ([string]::IsNullOrWhiteSpace($AccessToken)) { $AccessToken = $value } }
                "GCLOUD_PROJECT_ID" { if ([string]::IsNullOrWhiteSpace($ProjectId)) { $ProjectId = $value } }
            }
        }
    }
    Write-Host "Loaded .env" -ForegroundColor Green
}

# Find gcloud
$gcloudPath = $null
$paths = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)
foreach ($path in $paths) {
    if (Test-Path $path) {
        $gcloudPath = $path
        break
    }
}
if (-not $gcloudPath) {
    $gcloudPath = Get-ChildItem -Path $env:LOCALAPPDATA -Recurse -Filter "gcloud.cmd" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}

if (-not $gcloudPath -or -not (Test-Path $gcloudPath)) {
    Write-Host "gcloud CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

Write-Host "Found gcloud CLI" -ForegroundColor Green

# Check login
$account = & $gcloudPath config get-value account 2>&1
if (-not $account -or $account -match "ERROR" -or $account -match "unset") {
    Write-Host "Not logged in. Opening browser..." -ForegroundColor Yellow
    & $gcloudPath auth login
}

# Set project
if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    $currentProject = & $gcloudPath config get-value project 2>&1
    if ($currentProject -and $currentProject -notmatch "ERROR") {
        $ProjectId = $currentProject
        Write-Host "Using current project: $ProjectId" -ForegroundColor Green
    } else {
        $ProjectId = Read-Host "Enter Google Cloud Project ID"
        & $gcloudPath config set project $ProjectId
    }
} else {
    & $gcloudPath config set project $ProjectId
    Write-Host "Set project: $ProjectId" -ForegroundColor Green
}

# Enable APIs
Write-Host "Enabling APIs..." -ForegroundColor Yellow
& $gcloudPath services enable run.googleapis.com --quiet 2>&1 | Out-Null
& $gcloudPath services enable cloudscheduler.googleapis.com --quiet 2>&1 | Out-Null
Write-Host "APIs enabled" -ForegroundColor Green

# Ask for missing values
if ([string]::IsNullOrWhiteSpace($AppId)) {
    $AppId = Read-Host "Enter Nhanh.vn App ID"
}
if ([string]::IsNullOrWhiteSpace($BusinessId)) {
    $BusinessId = Read-Host "Enter Nhanh.vn Business ID"
}
if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    $tokenSecure = Read-Host "Enter Nhanh.vn Access Token" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure)
    $AccessToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Project ID: $ProjectId" -ForegroundColor Gray
Write-Host "  App ID: $AppId" -ForegroundColor Gray
Write-Host "  Business ID: $BusinessId" -ForegroundColor Gray
Write-Host ""

# Deploy
Write-Host "Deploying Cloud Run service..." -ForegroundColor Yellow
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
    Write-Host "Deploy failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Deploy successful!" -ForegroundColor Green

# Get service URL
$serviceUrl = & $gcloudPath run services describe order-processor --region asia-southeast1 --format 'value(status.url)' --project=$ProjectId
Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan

# Setup Scheduler
Write-Host ""
Write-Host "Setting up Cloud Scheduler..." -ForegroundColor Yellow
$existingJob = & $gcloudPath scheduler jobs describe order-processor-scheduler --location=asia-southeast1 --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Job exists. Updating..." -ForegroundColor Yellow
    & $gcloudPath scheduler jobs update http order-processor-scheduler `
        --location=asia-southeast1 `
        --schedule="*/1 * * * *" `
        --uri="$serviceUrl/process_order" `
        --http-method=GET `
        --time-zone="Asia/Ho_Chi_Minh" `
        --project=$ProjectId
} else {
    Write-Host "Creating Cloud Scheduler job..." -ForegroundColor Gray
    & $gcloudPath scheduler jobs create http order-processor-scheduler `
        --location=asia-southeast1 `
        --schedule="*/1 * * * *" `
        --uri="$serviceUrl/process_order" `
        --http-method=GET `
        --time-zone="Asia/Ho_Chi_Minh" `
        --project=$ProjectId
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Cloud Scheduler setup successful!" -ForegroundColor Green
} else {
    Write-Host "Failed to setup Cloud Scheduler. You can create it manually later." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan
Write-Host "Test: curl $serviceUrl/process_order" -ForegroundColor Gray

