const mongoose = require('mongoose');

const batteryHistorySchema = new mongoose.Schema({
  battery: { type: mongoose.Schema.Types.ObjectId, ref: 'Battery', required: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
  action: { type: String, enum: ['check-in', 'check-out', 'swap', 'repair', 'return'], required: true },
  soh: { type: Number, min: 0, max: 100 },
  details: { type: String },
  at: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('BatteryHistory', batteryHistorySchema);
