const mongoose = require('mongoose');
const crypto = require('crypto');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, unique: true, default: () => crypto.randomUUID(), index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  battery: { type: mongoose.Schema.Types.ObjectId, ref: 'Battery', index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  transaction_time: { type: Date, default: Date.now },
  cost: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
