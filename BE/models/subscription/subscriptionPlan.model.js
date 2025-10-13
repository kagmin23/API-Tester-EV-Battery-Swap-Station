const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  subcriptionName: { type: String, required: true },
  price: { type: Number, required: true },
  period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  benefits: [{ type: String }],
  status: { type: String, enum: ['active', 'expired'], default: 'active' },
  duration_months: { type: Number, min: 1, default: 1 },
  start_date: { type: Date },
  end_date: { type: Date },
}, { timestamps: true });

// Auto-calc end_date from start_date + duration_months
subscriptionPlanSchema.pre('save', function(next) {
  if (this.start_date && this.duration_months && !this.end_date) {
    const d = new Date(this.start_date);
    d.setMonth(d.getMonth() + this.duration_months);
    this.end_date = d;
  }
  if (this.end_date && new Date() > this.end_date) {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
