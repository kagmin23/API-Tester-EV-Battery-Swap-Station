# AI API Testing với PowerShell
# Usage: .\test-ai-curl.ps1

$BaseUrl = "http://localhost:3000"
$Token = ""
$StationId = ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "AI API TESTING - PowerShell" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# STEP 1: Login
Write-Host "STEP 1: Login..." -ForegroundColor Yellow

$loginBody = @{
    email = "admin@example.com"
    password = "your_password"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    
    $Token = $loginResponse.access_token
    Write-Host "Token: $Token" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $_" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 2
Write-Host ""

# STEP 2: Check Model Status
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "STEP 2: Check Model Status..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $Token"
    }
    
    $statusResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/model/status" `
        -Method Get `
        -Headers $headers
    
    Write-Host ($statusResponse | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2
Write-Host ""

# STEP 3: Get Stations
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "STEP 3: Get Stations..." -ForegroundColor Yellow

try {
    $stationsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/stations" `
        -Method Get `
        -Headers $headers
    
    if ($stationsResponse.data.Count -gt 0) {
        $StationId = $stationsResponse.data[0]._id
        Write-Host "Using Station ID: $StationId" -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2
Write-Host ""

# STEP 4: Train Model (Optional)
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "STEP 4: Train Model..." -ForegroundColor Yellow
$skipTrain = Read-Host "Skip training? (y/n)"

if ($skipTrain -ne "y") {
    try {
        $trainBody = @{
            daysBack = 90
            stationId = $null
        } | ConvertTo-Json
        
        Write-Host "Training model (this takes 2-5 minutes)..." -ForegroundColor Yellow
        
        $trainResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/train" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $trainBody
        
        Write-Host ($trainResponse | ConvertTo-Json -Depth 10)
    } catch {
        Write-Host "Training error: $_" -ForegroundColor Red
    }
}

Start-Sleep -Seconds 2
Write-Host ""

# STEP 5: Forecast Demand
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "STEP 5: Forecast Demand..." -ForegroundColor Yellow

try {
    $forecastBody = @{
        stationId = $StationId
        periods = 168
    } | ConvertTo-Json
    
    $forecastResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/forecast/demand" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $forecastBody
    
    Write-Host "Summary:" -ForegroundColor Green
    Write-Host ($forecastResponse.data.summary | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Forecast error: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2
Write-Host ""

# STEP 6: Get Capacity Recommendation
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "STEP 6: Get Capacity Recommendation..." -ForegroundColor Yellow

try {
    $recommendBody = @{
        stationId = $StationId
        bufferRate = 0.2
    } | ConvertTo-Json
    
    $recommendResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/recommendations/capacity" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $recommendBody
    
    Write-Host ($recommendResponse.data | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Recommendation error: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2
Write-Host ""

# STEP 7: Get All Recommendations
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "STEP 7: Get All Recommendations..." -ForegroundColor Yellow

try {
    $allRecommendResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/recommendations/all" `
        -Method Get `
        -Headers $headers
    
    Write-Host "Total Stations: $($allRecommendResponse.data.total_stations)" -ForegroundColor Green
    Write-Host "Needs Upgrade: $($allRecommendResponse.data.needs_upgrade)" -ForegroundColor Yellow
    Write-Host "High Priority: $($allRecommendResponse.data.high_priority)" -ForegroundColor Red
    
    Write-Host "`nTop 3 Recommendations:" -ForegroundColor Cyan
    $allRecommendResponse.data.recommendations[0..2] | ForEach-Object {
        Write-Host "`n  Station: $($_.station_name)" -ForegroundColor White
        Write-Host "  Urgency: $($_.recommendation.urgency)" -ForegroundColor $(
            if ($_.recommendation.urgency -eq "high") { "Red" } 
            elseif ($_.recommendation.urgency -eq "medium") { "Yellow" }
            else { "Green" }
        )
        Write-Host "  Current: $($_.analysis.current_capacity) -> Recommended: $($_.analysis.recommended_capacity)" -ForegroundColor White
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Testing completed!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan

