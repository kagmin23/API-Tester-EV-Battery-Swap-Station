const { mean, standardDeviation, min, max } = require('simple-statistics');
const Transaction = require('../../models/transaction/transaction.model');
const Station = require('../../models/station/station.model');

class DataProcessor {
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

    return this.aggregateByHour(transactions);
  }

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

    const hourlyData = Array.from(hourlyMap.values()).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    console.log(`✅ Aggregated to ${hourlyData.length} hourly records`);

    return hourlyData;
  }

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
      capacity: capacity,
      avgDemand: mean(counts),
      maxDemand: max(counts),
      minDemand: min(counts),
      stdDemand: standardDeviation(counts),
      avgUtilization: mean(counts) / capacity,
      maxUtilization: max(counts) / capacity,
      weekdayAvg: mean(data.filter(d => !d.isWeekend).map(d => d.count)),
      weekendAvg: mean(data.filter(d => d.isWeekend).map(d => d.count)),
      rushHourAvg: mean(data.filter(d => d.isRushHour).map(d => d.count)),
      trend: this.calculateTrend(counts),
      volatility: standardDeviation(counts) / mean(counts)
    };
  }

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

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}

module.exports = new DataProcessor();
