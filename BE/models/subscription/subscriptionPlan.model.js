const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  subscriptionName: { type: String, trim: true, default: '' },
  price: { type: Number, required: true },
  durations: { type: Number, min: 1, default: 1 },
  description: { type: String, trim: true, default: '' },
  count_swap: { type: Number, min: 0, default: null },
  quantity_slot: { type: Number, min: 1, default: null },
  status: { type: String, enum: ['active', 'expired'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
