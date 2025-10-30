const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date },
  // null = unlimited
  remaining_swaps: { type: Number, min: 0, default: null },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
