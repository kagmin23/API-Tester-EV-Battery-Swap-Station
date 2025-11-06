# Quick AI API Test
$BaseUrl = "http://localhost:3000"

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "AI API Quick Test" -ForegroundColor Cyan
Write-Host "=====================================`n" -ForegroundColor Cyan

# Step 1: Login
Write-Host "1. Login..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@example.com"
    password = "your_password"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$Token = $loginResponse.access_token

Write-Host "Token received!" -ForegroundColor Green

# Step 2: Check model status
Write-Host "`n2. Check model status..." -ForegroundColor Yellow
$headers = @{ "Authorization" = "Bearer $Token" }
$status = Invoke-RestMethod -Uri "$BaseUrl/api/ai/model/status" -Headers $headers
Write-Host ($status | ConvertTo-Json)

# Step 3: Train model
Write-Host "`n3. Train model (takes 1-2 minutes)..." -ForegroundColor Yellow
$trainBody = @{ daysBack = 90 } | ConvertTo-Json
$trainResult = Invoke-RestMethod -Uri "$BaseUrl/api/ai/train" -Method Post -Headers $headers -ContentType "application/json" -Body $trainBody
Write-Host "MAPE: $($trainResult.data.evaluation.mape)%" -ForegroundColor Green

# Step 4: Get stations
Write-Host "`n4. Get stations..." -ForegroundColor Yellow
$stations = Invoke-RestMethod -Uri "$BaseUrl/api/stations" -Headers $headers
$StationId = $stations.data[0]._id
Write-Host "Using station: $($stations.data[0].stationName)" -ForegroundColor Green

# Step 5: Get recommendations
Write-Host "`n5. Get all recommendations..." -ForegroundColor Yellow
$recs = Invoke-RestMethod -Uri "$BaseUrl/api/ai/recommendations/all" -Headers $headers
Write-Host "Total stations: $($recs.data.total_stations)" -ForegroundColor White
Write-Host "Needs upgrade: $($recs.data.needs_upgrade)" -ForegroundColor Yellow
Write-Host "High priority: $($recs.data.high_priority)" -ForegroundColor Red

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "Test completed!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan

