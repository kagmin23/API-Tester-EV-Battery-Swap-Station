const mongoose = require('mongoose');
const crypto = require('crypto');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, default: () => crypto.randomUUID(), index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending', index: true },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
