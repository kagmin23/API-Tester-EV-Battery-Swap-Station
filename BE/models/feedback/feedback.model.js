const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  images: [{ type: String }],
}, { timestamps: true });

// Ensure one feedback per user per booking
feedbackSchema.index({ user: 1, booking: 1 }, { unique: true });

module.exports = require('mongoose').model('Feedback', feedbackSchema);
