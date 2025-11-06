const forecaster = require('./forecaster');
const dataProcessor = require('./dataProcessor');
const Station = require('../../models/station/station.model');
const Transaction = require('../../models/transaction/transaction.model');

class PredictionService {
  async forecastDemand(stationId, periods = 168) {
    try {
      const historicalData = await dataProcessor.fetchHistoricalData(stationId, 90);

      if (historicalData.length < 10) {
        throw new Error('Không đủ dữ liệu lịch sử để dự báo (cần ít nhất 10 giờ)');
      }

      const counts = historicalData.map(d => d.count);
      
      const predictions = forecaster.holtWinters(counts, periods);

      const forecast = predictions.map((item, index) => {
        return {
          hour: item.hour,
          timestamp: item.timestamp.toISOString(),
          predicted_demand: item.predicted,
          confidence: this.calculateConfidence(index, periods)
        };
      });

      return {
        station_id: stationId,
        forecast_periods: periods,
        generated_at: new Date().toISOString(),
        forecast: forecast,
        summary: {
          avg_demand: forecast.reduce((sum, f) => sum + f.predicted_demand, 0) / forecast.length,
          peak_demand: Math.max(...forecast.map(f => f.predicted_demand)),
          min_demand: Math.min(...forecast.map(f => f.predicted_demand))
        }
      };

    } catch (error) {
      console.error('Forecast error:', error);
      throw error;
    }
  }

  async getCapacityRecommendation(stationId, bufferRate = 0.2) {
    try {
      const station = await Station.findById(stationId);
      if (!station) {
        throw new Error('Station not found');
      }

      const forecastResult = await this.forecastDemand(stationId, 168);
      const forecast = forecastResult.forecast;

      const demands = forecast.map(f => f.predicted_demand);
      const peakDemand = Math.max(...demands);
      const avgDemand = demands.reduce((a, b) => a + b, 0) / demands.length;

      const currentCapacity = station.capacity || 1;
      const currentUtilization = await this.calculateCurrentUtilization(stationId);

      const recommendedCapacity = Math.ceil(peakDemand * (1 + bufferRate));
      const forecastUtilization = currentCapacity > 0 ? (avgDemand / currentCapacity) * 100 : 0;

      let urgency = 'low';
      let priority = 3;
      
      if (forecastUtilization > 85 || peakDemand > currentCapacity) {
        urgency = 'high';
        priority = 1;
      } else if (forecastUtilization > 70) {
        urgency = 'medium';
        priority = 2;
      }

      const needsUpgrade = recommendedCapacity > currentCapacity;

      return {
        station_id: stationId,
        station_name: station.stationName,
        analysis: {
          current_capacity: currentCapacity,
          recommended_capacity: recommendedCapacity,
          capacity_gap: recommendedCapacity - currentCapacity,
          gap_percentage: currentCapacity > 0 ? ((recommendedCapacity - currentCapacity) / currentCapacity * 100).toFixed(1) : '0'
        },
        utilization: {
          current: currentUtilization,
          forecast_avg: forecastUtilization.toFixed(1),
          forecast_peak: currentCapacity > 0 ? (peakDemand / currentCapacity * 100).toFixed(1) : '0'
        },
        demand_analysis: {
          peak_demand: peakDemand,
          avg_demand: avgDemand.toFixed(2),
          min_demand: Math.min(...demands).toFixed(2)
        },
        recommendation: {
          needs_upgrade: needsUpgrade,
          urgency: urgency,
          priority: priority,
          reasoning: this.generateReasoning(
            currentCapacity,
            recommendedCapacity,
            forecastUtilization,
            urgency,
            peakDemand
          )
        },
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Recommendation error:', error);
      throw error;
    }
  }

  async getAllRecommendations() {
    const stations = await Station.find({ capacity: { $gt: 0 } });
    const recommendations = [];

    for (const station of stations) {
      try {
        const rec = await this.getCapacityRecommendation(station._id.toString());
        recommendations.push(rec);
      } catch (error) {
        console.error(`Error for station ${station._id}:`, error.message);
      }
    }

    recommendations.sort((a, b) => 
      a.recommendation.priority - b.recommendation.priority
    );

    return {
      total_stations: stations.length,
      analyzed_stations: recommendations.length,
      needs_upgrade: recommendations.filter(r => r.recommendation.needs_upgrade).length,
      high_priority: recommendations.filter(r => r.recommendation.urgency === 'high').length,
      recommendations: recommendations,
      generated_at: new Date().toISOString()
    };
  }

  async calculateCurrentUtilization(stationId) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const station = await Station.findById(stationId);
    if (!station || !station.capacity || station.capacity === 0) {
      return 0;
    }

    const txCount = await Transaction.countDocuments({
      station: stationId,
      transaction_time: { $gte: startDate, $lte: endDate }
    });

    const avgDailySwaps = txCount / 30;
    const utilization = (avgDailySwaps / station.capacity) * 100;

    return Math.round(utilization * 100) / 100;
  }

  calculateConfidence(index, totalPeriods) {
    const decay = 0.995;
    return Math.pow(decay, index) * 100;
  }

  generateReasoning(current, recommended, utilization, urgency, peakDemand) {
    if (recommended > current) {
      const gap = recommended - current;
      return (
        `Dựa trên phân tích AI với mô hình Holt-Winters, nhu cầu dự kiến trung bình đạt ${utilization.toFixed(1)}% ` +
        `công suất với nhu cầu cao điểm lên tới ${peakDemand.toFixed(0)} giao dịch/giờ. ` +
        `Khuyến nghị tăng công suất từ ${current} lên ${recommended} vị trí (+${gap} vị trí) ` +
        `với độ ưu tiên ${urgency}. Điều này sẽ đảm bảo dịch vụ ổn định, giảm thời gian chờ đợi ` +
        `và tối ưu trải nghiệm khách hàng.`
      );
    }
    return `Công suất hiện tại (${current} vị trí) đủ đáp ứng nhu cầu dự kiến (${utilization.toFixed(1)}%).`;
  }
}

module.exports = new PredictionService();

