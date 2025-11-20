const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date },
  // null = unlimited
  remaining_swaps: { type: Number, min: 0, default: null },
  // If the user chooses a fixed day each month to swap (1-28 recommended)
  monthly_day: { type: Number, min: 1, max: 28, default: null },
  // Track last month (YYYY-MM) when an automatic reservation was created/used
  last_reserved_month: { type: String, trim: true, default: null },
  // Station where periodic swaps should occur (optional for periodic plans)
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  status: { type: String, enum: ['active', 'in-use', 'expired', 'cancelled'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
