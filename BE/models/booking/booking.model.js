const mongoose = require('mongoose');
const crypto = require('crypto');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, default: () => crypto.randomUUID(), index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vehicle: { type: String, ref: 'Vehicle', required: true, index: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
  battery: { type: mongoose.Schema.Types.ObjectId, ref: 'Battery', required: true, index: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'ready', 'cancelled', 'completed'], default: 'pending', index: true },

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
