#!/bin/bash

# AI API Testing với cURL
# Usage: bash test-ai-curl.sh

BASE_URL="http://localhost:3000"
TOKEN=""
STATION_ID=""

echo "======================================"
echo "AI API TESTING - cURL Commands"
echo "======================================"
echo ""

# STEP 1: Login
echo "📝 STEP 1: Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }')

echo "Response: $LOGIN_RESPONSE"

# Extract token (requires jq)
if command -v jq &> /dev/null; then
    TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
    echo "✅ Token: $TOKEN"
else
    echo "⚠️  jq not installed. Please copy token manually."
    echo "📝 Copy access_token from above and paste here:"
    read TOKEN
fi

echo ""
sleep 2

# STEP 2: Check Model Status
echo "======================================"
echo "📝 STEP 2: Check Model Status..."
curl -X GET "$BASE_URL/api/ai/model/status" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

echo ""
sleep 2

# STEP 3: Get Stations
echo "======================================"
echo "📝 STEP 3: Get Stations..."
STATIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/stations" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATIONS_RESPONSE" | jq '.'

if command -v jq &> /dev/null; then
    STATION_ID=$(echo $STATIONS_RESPONSE | jq -r '.data[0]._id')
    echo "✅ Using Station ID: $STATION_ID"
else
    echo "📝 Enter a station ID:"
    read STATION_ID
fi

echo ""
sleep 2

# STEP 4: Train Model (Optional - comment out if already trained)
echo "======================================"
echo "📝 STEP 4: Train Model (takes 2-5 minutes)..."
echo "⚠️  Skip training? (y/n)"
read SKIP_TRAIN

if [ "$SKIP_TRAIN" != "y" ]; then
    curl -X POST "$BASE_URL/api/ai/train" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "daysBack": 90,
        "stationId": null
      }' \
      | jq '.'
    
    echo ""
    echo "⏱️  Waiting for training to complete..."
    sleep 5
fi

echo ""

# STEP 5: Forecast Demand
echo "======================================"
echo "📝 STEP 5: Forecast Demand..."
curl -X POST "$BASE_URL/api/ai/forecast/demand" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"stationId\": \"$STATION_ID\",
    \"periods\": 168
  }" \
  | jq '.data.summary'

echo ""
sleep 2

# STEP 6: Get Capacity Recommendation
echo "======================================"
echo "📝 STEP 6: Get Capacity Recommendation..."
curl -X POST "$BASE_URL/api/ai/recommendations/capacity" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"stationId\": \"$STATION_ID\",
    \"bufferRate\": 0.2
  }" \
  | jq '.data'

echo ""
sleep 2

# STEP 7: Get All Recommendations
echo "======================================"
echo "📝 STEP 7: Get All Recommendations..."
curl -X GET "$BASE_URL/api/ai/recommendations/all" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | {total_stations, needs_upgrade, high_priority, recommendations: .recommendations[:3]}'

echo ""
echo "======================================"
echo "✅ Testing completed!"
echo "======================================"

