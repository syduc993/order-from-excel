# Wrapper script - Doc .env va goi deploy.ps1
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
$params = @{}

if (Test-Path $envFile) {
    Write-Host "Reading .env file..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            $params[$key] = $value
        }
    }
    Write-Host "Loaded .env file" -ForegroundColor Green
}

# Map env vars to script params
$scriptParams = @{}
if ($params.ContainsKey("GCLOUD_PROJECT_ID")) {
    $scriptParams["ProjectId"] = $params["GCLOUD_PROJECT_ID"]
}
if ($params.ContainsKey("VITE_NHANH_APP_ID")) {
    $scriptParams["AppId"] = $params["VITE_NHANH_APP_ID"]
}
if ($params.ContainsKey("VITE_NHANH_BUSINESS_ID")) {
    $scriptParams["BusinessId"] = $params["VITE_NHANH_BUSINESS_ID"]
}
if ($params.ContainsKey("VITE_NHANH_ACCESS_TOKEN")) {
    $scriptParams["AccessToken"] = $params["VITE_NHANH_ACCESS_TOKEN"]
}

# Call original deploy script
& "$PSScriptRoot\deploy.ps1" @scriptParams

