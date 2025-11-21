const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  // start_date may be absent for a 'pending' preference; make optional
  start_date: { type: Date, default: null },
  end_date: { type: Date },
  // null = unlimited
  remaining_swaps: { type: Number, min: 0, default: null },
  // If the user chooses a fixed day each month to swap; stored as a Date (useful to capture timezone and initial choice)
  // Recommend day-of-month 1-28 to avoid month-length issues
  monthly_day: { type: Date, default: null },
  // Track last month (YYYY-MM) when an automatic reservation was created/used
  last_reserved_month: { type: String, trim: true, default: null },
  // Station where periodic swaps should occur (optional for periodic plans)
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  // include 'pending' so we can store pre-purchase preferences
  status: { type: String, enum: ['pending', 'active', 'in-use', 'expired', 'cancelled'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
