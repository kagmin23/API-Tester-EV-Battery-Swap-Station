# 🤖 AI SETUP GUIDE - STEP BY STEP

## 📦 STEP 1: Install Dependencies

Đã thêm các packages vào `package.json`:
- `@tensorflow/tfjs-node`: TensorFlow.js for Node.js (LSTM model)
- `@tensorflow/tfjs`: TensorFlow.js core
- `simple-statistics`: Statistical calculations
- `mathjs`: Math utilities

### Install:

```bash
cd BE
npm install
```

**Expected output:**
```
added 3 packages
```

**Verify installation:**
```bash
node -e "const tf = require('@tensorflow/tfjs-node'); console.log('TensorFlow.js version:', tf.version);"
```

Should output:
```
TensorFlow.js version: { tfjs-core: '4.15.0', ... }
```

---

## 📁 STEP 2: Create Folder Structure

```bash
# Tạo folders cho AI services
mkdir -p services/ai
mkdir -p controllers/ai
mkdir -p routes/ai
mkdir -p models/ai/lstm_model
```

**Structure:**
```
BE/
├── services/ai/
│   ├── dataProcessor.js
│   ├── lstmForecaster.js
│   ├── predictionService.js
│   └── modelTrainer.js
├── controllers/ai/
│   └── ai.controller.js
├── routes/ai/
│   └── ai.route.js
└── models/ai/
    └── lstm_model/ (will contain trained model files)
```

---

## ✅ COMMIT CHECKPOINT 1

```bash
git add package.json AI_SETUP.md
git commit -m "chore: add AI dependencies (TensorFlow.js, simple-statistics, mathjs)"
```

**Files changed:**
- ✅ `package.json` - Added AI dependencies
- ✅ `AI_SETUP.md` - Setup instructions

**Next step:** Implement Data Processor

