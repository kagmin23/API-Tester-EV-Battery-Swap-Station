const mongoose = require('mongoose');

const supportRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  images: [{ type: String }],
  status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
