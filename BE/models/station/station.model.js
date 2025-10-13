const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  stationName: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  district: { type: String, trim: true },
  map_url: { type: String, trim: true },
  capacity: { type: Number, min: 0, default: 0 },
  sohAvg: { type: Number, min: 0, max: 100, default: 100 },
  availableBatteries: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Station', stationSchema);
