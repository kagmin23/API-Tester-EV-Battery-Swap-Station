const mongoose = require('mongoose');
const crypto = require('crypto');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, default: () => crypto.randomUUID(), index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vehicle: { type: String, ref: 'Vehicle', required: true, index: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
  pillar: { type: mongoose.Schema.Types.ObjectId, ref: 'BatteryPillar', index: true },
  battery: { type: mongoose.Schema.Types.ObjectId, ref: 'Battery', required: true, index: true },
  scheduledTime: { type: Date, required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'UserSubscription', index: true },
  status: { type: String, enum: ['booked', 'arrived', 'cancelled', 'completed'], default: 'booked', index: true },

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
