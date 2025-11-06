const forecaster = require('./forecaster');
const dataProcessor = require('./dataProcessor');
const fs = require('fs').promises;
const path = require('path');

class ModelTrainer {
  constructor() {
    this.modelPath = path.join(__dirname, '../../models/ai/forecast_params.json');
  }

  async trainModel(stationId = null, daysBack = 90) {
    try {
      console.log('📊 Fetching historical data...');
      
      const historicalData = await dataProcessor.fetchHistoricalData(stationId, daysBack);

      if (historicalData.length < 48) {
        throw new Error('Insufficient data for training (need at least 48 hours)');
      }

      console.log(`✅ Fetched ${historicalData.length} hourly records`);

      const counts = historicalData.map(d => d.count);
      
      console.log('🧠 Calibrating forecasting parameters...');
      
      const splitPoint = Math.floor(counts.length * 0.8);
      const trainData = counts.slice(0, splitPoint);
      const testData = counts.slice(splitPoint);
      
      const testForecast = forecaster.holtWinters(trainData, testData.length);
      const testPredicted = testForecast.map(f => f.predicted);
      
      const evaluation = forecaster.evaluate(testData, testPredicted);
      
      console.log('📊 Evaluation Results:');
      console.log(`   MAE: ${evaluation.mae.toFixed(2)}`);
      console.log(`   RMSE: ${evaluation.rmse.toFixed(2)}`);
      console.log(`   MAPE: ${evaluation.mape.toFixed(2)}%`);

      const params = {
        alpha: 0.3,
        beta: 0.1,
        gamma: 0.1,
        seasonLength: 24,
        trainedAt: new Date().toISOString(),
        dataSize: historicalData.length,
        evaluation: evaluation
      };

      await fs.mkdir(path.dirname(this.modelPath), { recursive: true });
      await fs.writeFile(this.modelPath, JSON.stringify(params, null, 2));
      
      console.log(`✅ Parameters saved to ${this.modelPath}`);

      return {
        success: true,
        dataSize: historicalData.length,
        trainingSamples: splitPoint,
        validationSamples: testData.length,
        evaluation: evaluation,
        parameters: params
      };

    } catch (error) {
      console.error('❌ Training failed:', error);
      throw error;
    }
  }

  async getModelStatus() {
    try {
      await fs.access(this.modelPath);
      const content = await fs.readFile(this.modelPath, 'utf8');
      const params = JSON.parse(content);
      
      return {
        exists: true,
        trainedAt: params.trainedAt,
        evaluation: params.evaluation
      };
    } catch {
      return {
        exists: false
      };
    }
  }
}

module.exports = new ModelTrainer();
