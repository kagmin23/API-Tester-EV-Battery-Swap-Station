const predictionService = require('../../services/ai/predictionService');
const modelTrainer = require('../../services/ai/modelTrainer');

exports.forecastDemand = async (req, res) => {
  try {
    const { stationId, periods = 168 } = req.body;
    
    const forecast = await predictionService.forecastDemand(
      stationId,
      parseInt(periods)
    );
    
    res.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    console.error('Forecast Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi dự báo nhu cầu'
    });
  }
};

exports.getCapacityRecommendation = async (req, res) => {
  try {
    const { stationId, bufferRate = 0.2 } = req.body;
    
    const recommendation = await predictionService.getCapacityRecommendation(
      stationId,
      parseFloat(bufferRate)
    );
    
    res.json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    console.error('Recommendation Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy đề xuất nâng cấp'
    });
  }
};

exports.getAllRecommendations = async (req, res) => {
  try {
    const recommendations = await predictionService.getAllRecommendations();
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('All Recommendations Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách đề xuất'
    });
  }
};

exports.trainModel = async (req, res) => {
  try {
    const { stationId = null, daysBack = 90, forceRetrain = false } = req.body;
    
    const result = await modelTrainer.trainModel(
      stationId,
      parseInt(daysBack)
    );
    
    res.json({
      success: true,
      message: 'Model trained successfully',
      data: result
    });
  } catch (error) {
    console.error('Training Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi training model'
    });
  }
};

exports.getModelStatus = async (req, res) => {
  try {
    const status = await modelTrainer.getModelStatus();
    
    res.json({
      success: true,
      data: {
        model_exists: status.exists,
        status: status.exists ? 'ready' : 'not_trained',
        trained_at: status.trainedAt || null,
        evaluation: status.evaluation || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

