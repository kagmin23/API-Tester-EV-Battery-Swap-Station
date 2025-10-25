const mongoose = require('mongoose');

const batterySchema = new mongoose.Schema({
  serial: { type: String, required: true, unique: true, trim: true },
  model: { type: String, trim: true },
  soh: { type: Number, min: 0, max: 100, default: 100 },
  status: { type: String, enum: ['charging', 'full', 'faulty', 'in-use', 'idle', 'is-booking'], default: 'idle' },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
  manufacturer: { type: String, trim: true },
  capacity_kWh: { type: Number, min: 0 },
  voltage: { type: Number, min: 0 },
}, { timestamps: true });

// Middleware to update station battery counts when battery changes
batterySchema.post(['save', 'findOneAndUpdate', 'findOneAndDelete'], async function (doc) {
  if (doc && doc.station) {
    const Station = require('../station/station.model');
    const station = await Station.findById(doc.station);
    if (station) {
      await station.updateBatteryCounts();
    }
  }
});

// Middleware for bulk operations
batterySchema.post(['insertMany', 'updateMany', 'deleteMany'], async function () {
  const Station = require('../station/station.model');
  await Station.updateAllBatteryCounts();
});

module.exports = mongoose.model('Battery', batterySchema);
