const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  stationName: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  district: { type: String, trim: true },
  map_url: { type: String, trim: true },

  // Battery capacity management
  capacity: { type: Number, min: 0, default: 0 }, // Maximum battery slots
  sohAvg: { type: Number, min: 0, max: 100, default: 100 },

  // Real-time battery counts by status
  batteryCounts: {
    total: { type: Number, default: 0 },
    available: { type: Number, default: 0 }, // idle + full
    charging: { type: Number, default: 0 },
    inUse: { type: Number, default: 0 },
    faulty: { type: Number, default: 0 }
  },

  // Legacy field for backward compatibility
  availableBatteries: { type: Number, default: 0 },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  }
}, { timestamps: true });

// Index cần thiết cho truy vấn khoảng cách ($near)
stationSchema.index({ location: '2dsphere' });

// Method to update battery counts
stationSchema.methods.updateBatteryCounts = async function () {
  const Battery = require('../battery/battery.model');

  const counts = await Battery.aggregate([
    { $match: { station: this._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Initialize counts
  this.batteryCounts = {
    total: 0,
    available: 0,
    charging: 0,
    inUse: 0,
    faulty: 0
  };

  // Update counts based on status
  counts.forEach(item => {
    this.batteryCounts.total += item.count;

    switch (item._id) {
      case 'idle':
      case 'full':
        this.batteryCounts.available += item.count;
        break;
      case 'charging':
        this.batteryCounts.charging += item.count;
        break;
      case 'in-use':
        this.batteryCounts.inUse += item.count;
        break;
      case 'faulty':
        this.batteryCounts.faulty += item.count;
        break;
    }
  });

  // Update legacy field
  this.availableBatteries = this.batteryCounts.available;

  // Calculate average SOH
  const sohData = await Battery.aggregate([
    { $match: { station: this._id } },
    { $group: { _id: null, avgSoh: { $avg: '$soh' } } }
  ]);

  this.sohAvg = sohData.length > 0 ? Math.round(sohData[0].avgSoh) : 100;

  await this.save();
  return this;
};

// Static method to update all stations
stationSchema.statics.updateAllBatteryCounts = async function () {
  const stations = await this.find({});
  const results = [];

  for (const station of stations) {
    const updated = await station.updateBatteryCounts();
    results.push(updated);
  }

  return results;
};

module.exports = mongoose.model('Station', stationSchema);
