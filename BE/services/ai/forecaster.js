const { mean, standardDeviation } = require('simple-statistics');

class Forecaster {
  constructor() {
    this.lookback = 24;
  }

  holtWinters(data, periods, alpha = 0.3, beta = 0.1, gamma = 0.1) {
    const seasonLength = 24;
    const n = data.length;
    
    if (n < seasonLength * 2) {
      return this.simpleForecast(data, periods);
    }

    let level = mean(data.slice(0, seasonLength));
    let trend = this.calculateInitialTrend(data, seasonLength);
    let seasonals = this.calculateInitialSeasonals(data, seasonLength);
    
    const forecast = [];
    
    for (let i = 0; i < n; i++) {
      const seasonal = seasonals[i % seasonLength];
      const oldLevel = level;
      
      level = alpha * (data[i] - seasonal) + (1 - alpha) * (level + trend);
      trend = beta * (level - oldLevel) + (1 - beta) * trend;
      seasonals[i % seasonLength] = gamma * (data[i] - level) + (1 - gamma) * seasonal;
    }
    
    for (let i = 0; i < periods; i++) {
      const seasonal = seasonals[i % seasonLength];
      const value = Math.max(0, level + (i + 1) * trend + seasonal);
      
      forecast.push({
        hour: i + 1,
        predicted: Math.round(value * 100) / 100,
        timestamp: this.addHours(new Date(), i + 1)
      });
    }
    
    return forecast;
  }

  simpleForecast(data, periods) {
    const windowSize = Math.min(24, Math.floor(data.length / 2));
    const recentAvg = mean(data.slice(-windowSize));
    
    return Array.from({ length: periods }, (_, i) => ({
      hour: i + 1,
      predicted: recentAvg,
      timestamp: this.addHours(new Date(), i + 1)
    }));
  }

  calculateInitialTrend(data, seasonLength) {
    let sum = 0;
    for (let i = 0; i < seasonLength; i++) {
      sum += (data[i + seasonLength] - data[i]) / seasonLength;
    }
    return sum / seasonLength;
  }

  calculateInitialSeasonals(data, seasonLength) {
    const seasonals = new Array(seasonLength).fill(0);
    const seasonAverages = [];
    
    for (let i = 0; i < Math.floor(data.length / seasonLength); i++) {
      const start = i * seasonLength;
      const end = start + seasonLength;
      seasonAverages.push(mean(data.slice(start, end)));
    }
    
    for (let i = 0; i < seasonLength; i++) {
      let sum = 0;
      for (let j = 0; j < seasonAverages.length; j++) {
        sum += data[j * seasonLength + i] / seasonAverages[j];
      }
      seasonals[i] = sum / seasonAverages.length;
    }
    
    return seasonals;
  }

  evaluate(actual, predicted) {
    let mapeSum = 0;
    let maeSum = 0;
    let mseSum = 0;
    let validCount = 0;
    
    for (let i = 0; i < Math.min(actual.length, predicted.length); i++) {
      const a = actual[i];
      const p = predicted[i];
      
      maeSum += Math.abs(a - p);
      mseSum += Math.pow(a - p, 2);
      
      if (a !== 0) {
        mapeSum += Math.abs((a - p) / a);
        validCount++;
      }
    }
    
    const n = Math.min(actual.length, predicted.length);
    
    return {
      mae: maeSum / n,
      rmse: Math.sqrt(mseSum / n),
      mape: validCount > 0 ? (mapeSum / validCount) * 100 : 0
    };
  }

  addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }
}

module.exports = new Forecaster();

