const { mean, standardDeviation, min, max } = require('simple-statistics');
const Transaction = require('../../models/transaction/transaction.model');
const Booking = require('../../models/booking/booking.model');
const Station = require('../../models/station/station.model');

class DataProcessor {
  constructor() {
    this.scaler = {
      mean: 0,
      std: 1,
      min: 0,
      max: 1
    };
  }

  /**
   * Fetch và aggregate historical data từ MongoDB
   * 
   * @param {string|null} stationId
   * @param {number} daysBack 
   * @returns {Promise<Array>} 
   */
  async fetchHistoricalData(stationId = null, daysBack = 90) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    console.log(`📊 Fetching ${daysBack} days of data...`);
    console.log(`   From: ${startDate.toISOString()}`);
    console.log(`   To: ${endDate.toISOString()}`);

    const query = {
      transaction_time: { $gte: startDate, $lte: endDate }
    };
    
    if (stationId) {
      query.station = stationId;
    }

    const transactions = await Transaction.find(query)
      .populate('station', 'stationName capacity city')
      .sort({ transaction_time: 1 });

    console.log(`✅ Found ${transactions.length} transactions`);

    if (transactions.length === 0) {
      throw new Error('No transactions found in the specified date range');
    }

    // Aggregate by hour
    return this.aggregateByHour(transactions);
  }

  /**
   * Aggregate transactions by hour
   * 
   * @param {Array} transactions - Array of transaction documents
   * @returns {Array} Hourly aggregated data with features
   */
  aggregateByHour(transactions) {
    const hourlyMap = new Map();

    transactions.forEach(tx => {
      const date = new Date(tx.transaction_time);
      
      const hourKey = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours()
      ).toISOString();

      if (!hourlyMap.has(hourKey)) {
        hourlyMap.set(hourKey, {
          timestamp: hourKey,
          count: 0,
          revenue: 0,
          hour: date.getHours(),
          dayOfWeek: date.getDay(),
          dayOfMonth: date.getDate(),
          month: date.getMonth(),
          isWeekend: (date.getDay() === 0 || date.getDay() === 6) ? 1 : 0,
          isRushHour: [7, 8, 9, 17, 18, 19].includes(date.getHours()) ? 1 : 0,
        });
      }

      const entry = hourlyMap.get(hourKey);
      entry.count += 1;
      entry.revenue += tx.cost || 0;
    });

    // Convert map to sorted array
    const hourlyData = Array.from(hourlyMap.values()).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    console.log(`✅ Aggregated to ${hourlyData.length} hourly records`);

    return hourlyData;
  }

  /**
   * Create sequences for LSTM training
   * Input: [t-n, t-n+1, ..., t-1] → Output: [t]
   * 
   * @param {Array} data 
   * @param {number} lookback 
   * @param {string} targetKey 
   * @returns {Object}
   */
  createSequences(data, lookback = 24, targetKey = 'count') {
    const sequences = [];
    const targets = [];
    const features = [];

    console.log(`🔄 Creating sequences with lookback=${lookback}...`);

    data.forEach(item => {
      features.push([
        item[targetKey],           // 0: count (target variable)
        item.hour / 23,            // 1: normalized hour (0-1)
        item.dayOfWeek / 6,        // 2: normalized day of week (0-1)
        item.dayOfMonth / 31,      // 3: normalized day of month (0-1)
        item.month / 11,           // 4: normalized month (0-1)
        item.isWeekend,            // 5: is weekend (0 or 1)
        item.isRushHour            // 6: is rush hour (0 or 1)
      ]);
    });

    // Create sequences
    for (let i = lookback; i < features.length; i++) {
      const sequence = features.slice(i - lookback, i);
      const target = features[i][0]; // Next count value
      
      sequences.push(sequence);
      targets.push(target);
    }

    console.log(`✅ Created ${sequences.length} sequences`);

    return { sequences, targets };
  }

  /**
   * Normalize data using Min-Max scaling
   * Formula: (value - min) / (max - min)
   * 
   * @param {Array} data 
   * @param {boolean} fit 
   * @returns {Array}
   */
  normalize(data, fit = true) {
    const values = data.flat();
    
    if (fit) {
      this.scaler.min = min(values);
      this.scaler.max = max(values);
      
      console.log(`📏 Scaler fitted: min=${this.scaler.min.toFixed(2)}, max=${this.scaler.max.toFixed(2)}`);
    }

    const range = this.scaler.max - this.scaler.min;
    
    if (range === 0) {
      console.warn('⚠️  Range is 0, returning original data');
      return data;
    }

    return data.map(val => 
      (val - this.scaler.min) / range
    );
  }

  /**
   * Denormalize predictions back to original scale
   * Formula: value * (max - min) + min
   * 
   * @param {Array} normalizedValues 
   * @returns {Array}
   */
  denormalize(normalizedValues) {
    const range = this.scaler.max - this.scaler.min;
    return normalizedValues.map(val => 
      val * range + this.scaler.min
    );
  }

  /**
   * Convert sequences and targets to TensorFlow tensors
   * 
   * @param {Array} sequences 
   * @param {Array} targets
   * @returns {Object} 
   */
  toTensor(sequences, targets) {
    console.log('🔧 Converting to tensors...');
    
    // Validate input
    if (!sequences || sequences.length === 0) {
      throw new Error('Sequences array is empty');
    }

    const xs = tf.tensor3d(sequences); 
    const ys = tf.tensor2d(targets.map(t => [t])); 
    
    console.log(`✅ Tensors created:`);
    console.log(`   xs shape: [${xs.shape}] (samples, timesteps, features)`);
    console.log(`   ys shape: [${ys.shape}] (samples, output)`);

    return { xs, ys };
  }

  /**
   * Split data into training and validation sets
   * IMPORTANT: No shuffling for time series!
   * 
   * @param {Tensor} xs 
   * @param {Tensor} ys 
   * @param {number} testSize 
   * @returns {Object} 
  trainTestSplit(xs, ys, testSize = 0.2) {
    const totalSamples = xs.shape[0];
    const trainSize = Math.floor(totalSamples * (1 - testSize));

    console.log(`✂️  Splitting data:`);
    console.log(`   Total samples: ${totalSamples}`);
    console.log(`   Training: ${trainSize} (${((1 - testSize) * 100).toFixed(0)}%)`);
    console.log(`   Validation: ${totalSamples - trainSize} (${(testSize * 100).toFixed(0)}%)`);

    // Temporal split (no shuffle!)
    const xsTrain = xs.slice([0, 0, 0], [trainSize, -1, -1]);
    const ysTrain = ys.slice([0, 0], [trainSize, -1]);
    
    const xsTest = xs.slice([trainSize, 0, 0], [-1, -1, -1]);
    const ysTest = ys.slice([trainSize, 0], [-1, -1]);

    return { xsTrain, ysTrain, xsTest, ysTest };
  }

  /**
   * Calculate linear trend of a time series
   * 
   * @param {Array} values - Array of values
   * @returns {number} Slope of trend line
   */
  calculateTrend(values) {
    const n = values.length;
    if (n < 2) return 0;

    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return slope;
  }

  /**
   * Engineer features for capacity recommendation
   * 
   * @param {string} stationId - Station ID
   * @returns {Promise<Object>} Engineered features
   */
  async engineerFeatures(stationId) {
    const station = await Station.findById(stationId);
    if (!station) {
      throw new Error('Station not found');
    }

    const data = await this.fetchHistoricalData(stationId, 30);

    if (data.length === 0) {
      return null;
    }

    const counts = data.map(d => d.count);
    const capacity = station.capacity || 1;

    return {
      // Station features
      capacity: capacity,
      
      // Statistical features
      avgDemand: mean(counts),
      maxDemand: max(counts),
      minDemand: min(counts),
      stdDemand: standardDeviation(counts),
      
      // Utilization
      avgUtilization: mean(counts) / capacity,
      maxUtilization: max(counts) / capacity,
      
      // Time-based patterns
      weekdayAvg: mean(data.filter(d => !d.isWeekend).map(d => d.count)),
      weekendAvg: mean(data.filter(d => d.isWeekend).map(d => d.count)),
      rushHourAvg: mean(data.filter(d => d.isRushHour).map(d => d.count)),
      
      // Trends
      trend: this.calculateTrend(counts),
      volatility: standardDeviation(counts) / mean(counts)
    };
  }

  /**
   * Get summary statistics
   * 
   * @param {Array} data - Array of data points
   * @returns {Object} Statistics
   */
  getStatistics(data) {
    const values = data.map(d => d.count);
    
    return {
      count: data.length,
      mean: mean(values),
      median: this.calculateMedian(values),
      std: standardDeviation(values),
      min: min(values),
      max: max(values),
      range: max(values) - min(values)
    };
  }

  /**
   * Calculate median
   * 
   * @param {Array} values - Array of numbers
   * @returns {number} Median value
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}

module.exports = new DataProcessor();

