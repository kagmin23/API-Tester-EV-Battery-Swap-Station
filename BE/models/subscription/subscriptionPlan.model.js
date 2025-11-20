const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  subscriptionName: { type: String, trim: true, default: '' },
  price: { type: Number, required: true },
  durations: { type: Number, min: 1, default: 1 },
  description: { type: String, trim: true, default: '' },
  count_swap: { type: Number, min: 0, default: null },
  quantity_slot: { type: Number, min: 1, default: null },
  // type: 'change' = per-swap (legacy), 'periodic' = fixed monthly day
  type: { type: String, enum: ['change', 'periodic'], default: 'change' },
  status: { type: String, enum: ['active', 'expired'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
