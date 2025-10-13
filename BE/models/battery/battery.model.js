const mongoose = require('mongoose');

const batterySchema = new mongoose.Schema({
  serial: { type: String, required: true, unique: true, trim: true },
  model: { type: String, trim: true },
  soh: { type: Number, min: 0, max: 100, default: 100 },
  status: { type: String, enum: ['charging', 'full', 'faulty', 'in-use', 'idle'], default: 'idle' },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
  manufacturer: { type: String, trim: true },
  capacity_kWh: { type: Number, min: 0 },
  voltage: { type: Number, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Battery', batterySchema);
