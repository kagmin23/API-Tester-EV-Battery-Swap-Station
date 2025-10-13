const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true },
  method: { type: String, enum: ['vnpay', 'cash'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  status: { type: String, enum: ['init', 'success', 'failed', 'cancelled'], default: 'init', index: true },
  // VNPAY specific
  vnpTxnRef: { type: String, index: true },
  vnpOrderInfo: { type: String },
  vnpResponseCode: { type: String },
  vnpSecureHash: { type: String },
  extra: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
