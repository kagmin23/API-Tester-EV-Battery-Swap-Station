/**
 * LSTM FORECASTER SERVICE
 * LSTM Neural Network for time series demand forecasting
 */

const tf = require('@tensorflow/tfjs-node');
const path = require('path');
const fs = require('fs').promises;

class LSTMForecaster {
  constructor() {
    this.model = null;
    this.modelPath = path.join(__dirname, '../../models/ai/lstm_model');
    this.lookback = 24;
    this.isCompiled = false;
  }

  buildModel(inputShape) {
    console.log('🏗️  Building LSTM model...');
    console.log(`   Input shape: [${inputShape}] (timesteps, features)`);

    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
          inputShape: inputShape,
          dropout: 0.2,
          recurrentDropout: 0.2,
          name: 'lstm_1'
        }),
        tf.layers.lstm({
          units: 32,
          returnSequences: false,
          dropout: 0.2,
          recurrentDropout: 0.2,
          name: 'lstm_2'
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          name: 'dense_1'
        }),
        tf.layers.dropout({
          rate: 0.2,
          name: 'dropout_1'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'linear',
          name: 'output'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    this.model = model;
    this.isCompiled = true;
    
    console.log('✅ LSTM Model built successfully');
    console.log('\n📊 Model Summary:');
    model.summary();
    
    return model;
  }

  async train(xsTrain, ysTrain, xsVal, ysVal, epochs = 50, batchSize = 32) {
    if (!this.model || !this.isCompiled) {
      const inputShape = [xsTrain.shape[1], xsTrain.shape[2]];
      this.buildModel(inputShape);
    }

    console.log('\n🚀 Starting LSTM training...');
    console.log(`   Training samples: ${xsTrain.shape[0]}`);
    console.log(`   Validation samples: ${xsVal.shape[0]}`);
    console.log(`   Epochs: ${epochs}`);
    console.log(`   Batch size: ${batchSize}`);

    const earlyStoppingCallback = tf.callbacks.earlyStopping({
      monitor: 'val_loss',
      patience: 10,
      restoreBestWeights: true
    });

    const loggingCallback = {
      onEpochEnd: (epoch, logs) => {
        console.log(
          `Epoch ${epoch + 1}/${epochs} - ` +
          `loss: ${logs.loss.toFixed(4)}, ` +
          `mae: ${logs.mae.toFixed(4)}, ` +
          `val_loss: ${logs.val_loss.toFixed(4)}, ` +
          `val_mae: ${logs.val_mae.toFixed(4)}`
        );
      }
    };

    const history = await this.model.fit(xsTrain, ysTrain, {
      epochs: epochs,
      batchSize: batchSize,
      validationData: [xsVal, ysVal],
      callbacks: [earlyStoppingCallback, loggingCallback],
      shuffle: true,
      verbose: 0
    });

    console.log('\n✅ Training completed!');
    await this.save();

    return {
      history: {
        loss: history.history.loss,
        val_loss: history.history.val_loss,
        mae: history.history.mae,
        val_mae: history.history.val_mae
      },
      finalMetrics: {
        loss: history.history.loss[history.history.loss.length - 1],
        val_loss: history.history.val_loss[history.history.val_loss.length - 1],
        mae: history.history.mae[history.history.mae.length - 1],
        val_mae: history.history.val_mae[history.history.val_mae.length - 1]
      }
    };
  }

  async predict(sequences) {
    if (!this.model) {
      await this.load();
    }

    const tensor = tf.tensor3d(sequences);
    const predictions = this.model.predict(tensor);
    const values = await predictions.array();
    
    tensor.dispose();
    predictions.dispose();

    return values.map(v => v[0]);
  }

  async forecast(lastSequence, steps = 24) {
    if (!this.model) {
      await this.load();
    }

    console.log(`🔮 Forecasting ${steps} steps ahead...`);

    const predictions = [];
    let currentSequence = [...lastSequence];

    for (let i = 0; i < steps; i++) {
      const input = tf.tensor3d([currentSequence]);
      const prediction = this.model.predict(input);
      const value = (await prediction.array())[0][0];
      
      predictions.push(value);

      const lastFeatures = [...currentSequence[currentSequence.length - 1]];
      lastFeatures[0] = value;
      
      currentSequence.shift();
      currentSequence.push(lastFeatures);

      input.dispose();
      prediction.dispose();
    }

    console.log(`✅ Forecast completed: ${predictions.length} values`);

    return predictions;
  }

  async evaluate(xsTest, ysTest) {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    console.log('📈 Evaluating model...');

    const result = this.model.evaluate(xsTest, ysTest);
    const loss = await result[0].array();
    const mae = await result[1].array();

    const predictions = this.model.predict(xsTest);
    const predArray = await predictions.array();
    const actualArray = await ysTest.array();

    let mapeSum = 0;
    let validCount = 0;
    
    for (let i = 0; i < predArray.length; i++) {
      const actual = actualArray[i][0];
      const pred = predArray[i][0];
      
      if (actual !== 0) {
        mapeSum += Math.abs((actual - pred) / actual);
        validCount++;
      }
    }
    
    const mape = validCount > 0 ? (mapeSum / validCount) * 100 : 0;
    const rmse = Math.sqrt(loss);

    predictions.dispose();

    const metrics = {
      loss: loss,
      mae: mae,
      rmse: rmse,
      mape: mape
    };

    console.log('📊 Evaluation Results:');
    console.log(`   Loss (MSE): ${loss.toFixed(4)}`);
    console.log(`   MAE: ${mae.toFixed(4)}`);
    console.log(`   RMSE: ${rmse.toFixed(4)}`);
    console.log(`   MAPE: ${mape.toFixed(2)}%`);

    return metrics;
  }

  async save() {
    if (!this.model) {
      throw new Error('No model to save');
    }

    try {
      await fs.mkdir(this.modelPath, { recursive: true });
      await this.model.save(`file://${this.modelPath}`);
      console.log(`💾 Model saved to ${this.modelPath}`);
    } catch (error) {
      console.error('❌ Error saving model:', error);
      throw error;
    }
  }

  async load() {
    try {
      const modelJsonPath = path.join(this.modelPath, 'model.json');
      await fs.access(modelJsonPath);
      
      this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
      this.isCompiled = true;
      
      console.log('✅ Model loaded successfully from', this.modelPath);
      return true;
    } catch (error) {
      console.log('⚠️  No saved model found. Need to train first.');
      return false;
    }
  }

  async modelExists() {
    try {
      const modelJsonPath = path.join(this.modelPath, 'model.json');
      await fs.access(modelJsonPath);
      return true;
    } catch {
      return false;
    }
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isCompiled = false;
      console.log('🧹 Model disposed');
    }
  }

  getModelInfo() {
    if (!this.model) {
      return { loaded: false };
    }

    return {
      loaded: true,
      inputShape: this.model.inputs[0].shape,
      outputShape: this.model.outputs[0].shape,
      trainable: this.model.trainable,
      layers: this.model.layers.length,
      lookback: this.lookback
    };
  }
}

module.exports = LSTMForecaster;

