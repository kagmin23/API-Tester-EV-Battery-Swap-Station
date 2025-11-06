# ⚡ QUICK TEST GUIDE

## 🚀 Cách nhanh nhất để test AI API (không cần Frontend)

### **CÁCH 1: REST Client trong VS Code** (KHUYẾN NGHỊ)

**Bước 1:** Install Extension
```
1. Mở VS Code
2. Ctrl+Shift+X (hoặc Cmd+Shift+X trên Mac)
3. Tìm "REST Client" by Huachao Mao
4. Click Install
```

**Bước 2:** Mở file test
```
File: BE/test-ai-api.http
```

**Bước 3:** Test từng bước

```http
### 1. Login (Lấy token)
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your_password"
}

### Click "Send Request" ở trên ⬆️
### Copy access_token từ response

### 2. Update token ở đầu file
@token = PASTE_TOKEN_HERE

### 3. Check model status
GET http://localhost:3000/api/ai/model/status
Authorization: Bearer {{token}}

### 4. Train model (chỉ lần đầu)
POST http://localhost:3000/api/ai/train
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "daysBack": 90
}

### 5. Get recommendations
GET http://localhost:3000/api/ai/recommendations/all
Authorization: Bearer {{token}}
```

---

### **CÁCH 2: Postman**

**Bước 1:** Import Collection
```
1. Mở Postman
2. File → Import
3. Chọn: BE/AI-API-Postman.json
4. Collection sẽ xuất hiện sidebar bên trái
```

**Bước 2:** Chạy requests
```
1. Click "1. Login" → Send
   → Token tự động lưu vào biến
2. Click "3. Train Model" → Send
3. Click "7. Get All Recommendations" → Send
```

---

### **CÁCH 3: PowerShell (Windows)**

**Chạy script:**
```powershell
cd BE
.\test-ai-curl.ps1
```

Script sẽ tự động:
- ✅ Login
- ✅ Lấy token
- ✅ Test tất cả endpoints
- ✅ Hiển thị kết quả màu mè

---

### **CÁCH 4: Terminal cURL (Mac/Linux)**

```bash
cd BE
bash test-ai-curl.sh
```

---

## 📊 Expected Results

### ✅ Training Success:
```json
{
  "success": true,
  "data": {
    "evaluation": {
      "mape": 6.8,      // < 10% = Excellent
      "mae": 1.2,
      "rmse": 1.8
    }
  }
}
```

### ✅ Forecast Result:
```json
{
  "success": true,
  "data": {
    "summary": {
      "avg_demand": 16.5,
      "peak_demand": 35.2,
      "min_demand": 5.1
    }
  }
}
```

### ✅ Recommendations Result:
```json
{
  "success": true,
  "data": {
    "total_stations": 15,
    "needs_upgrade": 5,
    "high_priority": 2
  }
}
```

---

## ⚠️ Common Issues

### ❌ Error: "Model chưa được train"
**Solution:**
```
POST /api/ai/train trước
```

### ❌ Error: "Unauthorized"
**Solution:**
```
1. Login lại để lấy token mới
2. Check token có đúng trong header không
```

### ❌ Error: "Insufficient data"
**Solution:**
```
- Cần ít nhất 30 ngày transactions
- Hoặc giảm daysBack xuống 30-60
```

---

## 🎯 Workflow Testing

```
START
  ↓
1. npm start (Start server)
  ↓
2. Login → Copy token
  ↓
3. Check model status
  ↓
4. Train model (nếu chưa train)
  ↓ (chờ 2-5 phút)
5. Test forecast cho 1 trạm
  ↓
6. Test recommendations
  ↓
END
```

**Total time:** ~10 phút (bao gồm training)

---

## 📝 Files để Test

```
BE/
├── test-ai-api.http          # REST Client (VS Code)
├── AI-API-Postman.json        # Postman Collection
├── test-ai-curl.sh            # Bash script (Mac/Linux)
└── test-ai-curl.ps1           # PowerShell script (Windows)
```

**Chọn 1 trong 4 cách trên tùy preference!**

---

**Pro Tip:** REST Client trong VS Code là nhanh nhất vì:
- ✅ Không cần mở app riêng
- ✅ File .http có syntax highlighting
- ✅ Save được trong git
- ✅ Click là chạy

🚀 Happy Testing!

