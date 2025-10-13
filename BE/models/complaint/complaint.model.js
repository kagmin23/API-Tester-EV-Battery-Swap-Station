const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['open', 'in-review', 'resolved', 'closed'], default: 'open', index: true },
  response: { type: String },
  images: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
