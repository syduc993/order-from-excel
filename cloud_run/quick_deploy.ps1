# Quick deploy script - reads from .env or asks user
param()

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
$appId = ""
$businessId = ""
$accessToken = ""
$projectId = ""

# Read .env if exists
if (Test-Path $envFile) {
    Write-Host "Reading .env..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            switch ($key) {
                "VITE_NHANH_APP_ID" { $appId = $value }
                "VITE_NHANH_BUSINESS_ID" { $businessId = $value }
                "VITE_NHANH_ACCESS_TOKEN" { $accessToken = $value }
                "GCLOUD_PROJECT_ID" { $projectId = $value }
            }
        }
    }
    Write-Host "Loaded .env" -ForegroundColor Green
}

# Ask for missing values
if ([string]::IsNullOrWhiteSpace($appId)) {
    $appId = Read-Host "Enter Nhanh.vn App ID"
}
if ([string]::IsNullOrWhiteSpace($businessId)) {
    $businessId = Read-Host "Enter Nhanh.vn Business ID"
}
if ([string]::IsNullOrWhiteSpace($accessToken)) {
    $tokenSecure = Read-Host "Enter Nhanh.vn Access Token" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure)
    $accessToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Call deploy.ps1 with parameters
$deployParams = @{
    AppId = $appId
    BusinessId = $businessId
    AccessToken = $accessToken
}
if (-not [string]::IsNullOrWhiteSpace($projectId)) {
    $deployParams["ProjectId"] = $projectId
}

& "$PSScriptRoot\deploy.ps1" @deployParams

