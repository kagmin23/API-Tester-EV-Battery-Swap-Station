const mongoose = require('mongoose');

const stationRatingSchema = new mongoose.Schema({
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
}, { timestamps: true });

stationRatingSchema.index({ station: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('StationRating', stationRatingSchema);
