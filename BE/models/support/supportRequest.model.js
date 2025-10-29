const mongoose = require('mongoose');

const supportRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  images: [{ type: String }],
  status: { type: String, enum: ['in-progress', 'resolved', 'completed', 'closed'], default: 'in-progress', index: true },
  // Timestamps for lifecycle events
  resolvedAt: { type: Date, default: null, index: true },
  // Who performed the resolution and optional note visible to driver/staff
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  resolveNote: { type: String, default: null },
  completedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  // Who closed the ticket and a note visible to the driver
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  closeNote: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
