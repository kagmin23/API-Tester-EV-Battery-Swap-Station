const Booking = require('../../models/booking/booking.model');
const Feedback = require('../../models/feedback/feedback.model');
const mongoose = require('mongoose');

// Create feedback: only booking owner (driver) can create AND booking.status === 'completed'
const createFeedback = async (req, res) => {
  try {
    const { bookingId, rating, comment, images } = req.body || {};

  if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId is required' });
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'rating must be between 1 and 5' });

    // bookingId might be either Mongo _id or the booking.bookingId (UUID) field.
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      booking = await Booking.findById(bookingId).populate('user');
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: bookingId }).populate('user');
    }
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Feedback can only be created for completed bookings' });
    }

    // Only booking owner can create feedback
    if (!req.user || String(booking.user._id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only the booking owner can create feedback' });
    }

    // Prevent duplicate (also enforced by unique index)
    const existing = await Feedback.findOne({ user: req.user.id, booking: booking._id });
  if (existing) return res.status(409).json({ success: false, message: 'Feedback already submitted for this booking' });

    const created = await Feedback.create({
      user: req.user.id,
      booking: booking._id,
      rating,
      comment,
      images: Array.isArray(images) ? images : undefined,
    });

    const populated = await Feedback.findById(created._id)
      .populate('user', 'fullName email')
      .populate({ path: 'booking', populate: [{ path: 'station' }, { path: 'battery' }] });

  return res.status(201).json({ success: true, data: populated, message: 'Feedback created' });
  } catch (err) {
    // handle unique constraint error
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Feedback already exists for this booking' });
    }
    console.error('createFeedback error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get all feedbacks — public
const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .sort({ createdAt: -1 })
      .populate('user', 'fullName email')
      .populate({ path: 'booking', populate: [{ path: 'station' }, { path: 'battery' }] });

    return res.json({ success: true, data: feedbacks, message: 'Feedbacks retrieved' });
  } catch (err) {
    console.error('getAllFeedbacks error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { createFeedback, getAllFeedbacks };

// Get feedbacks for a given station (public) — find bookings at station then feedbacks for those bookings
const getFeedbacksByStation = async (req, res) => {
  try {
    const { stationId } = req.params;
    if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ success: false, message: 'Invalid stationId' });
    }

    const bookings = await Booking.find({ station: stationId }).select('_id');
    const bookingIds = bookings.map(b => b._id);

    if (bookingIds.length === 0) {
      return res.json({ success: true, data: [], message: 'Feedbacks retrieved' });
    }

    const feedbacks = await Feedback.find({ booking: { $in: bookingIds } })
      .sort({ createdAt: -1 })
      .populate('user', 'fullName email')
      .populate({ path: 'booking', populate: [{ path: 'station' }, { path: 'battery' }] });

    return res.json({ success: true, data: feedbacks, message: 'Feedbacks retrieved' });
  } catch (err) {
    console.error('getFeedbacksByStation error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get current user's feedback for a specific booking (authenticated)
const getMyFeedbackByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId is required' });

    // resolve booking _id from either ObjectId or booking.bookingId
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      booking = await Booking.findById(bookingId).select('_id');
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: bookingId }).select('_id');
    }
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const feedback = await Feedback.findOne({ booking: booking._id, user: req.user.id })
      .populate('user', 'fullName email')
      .populate({ path: 'booking', populate: [{ path: 'station' }, { path: 'battery' }] });

    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found for this booking by the user' });

    return res.json({ success: true, data: feedback, message: 'Feedback retrieved' });
  } catch (err) {
    console.error('getMyFeedbackByBooking error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: list feedbacks with optional filters (stationId, bookingId, userId) and pagination
const adminListFeedbacks = async (req, res) => {
  try {
    const { stationId, bookingId, userId, page = 1, limit = 50 } = req.query;
    const filters = {};

    if (bookingId) {
      // bookingId filter may be Mongo _id or booking.bookingId (UUID string)
      if (mongoose.Types.ObjectId.isValid(bookingId)) {
        filters.booking = bookingId;
      } else {
        const bk = await Booking.findOne({ bookingId: bookingId }).select('_id');
        if (!bk) return res.status(400).json({ success: false, message: 'Invalid bookingId' });
        filters.booking = bk._id;
      }
    }

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: 'Invalid userId' });
      filters.user = userId;
    }

    if (stationId) {
      if (!mongoose.Types.ObjectId.isValid(stationId)) return res.status(400).json({ success: false, message: 'Invalid stationId' });
      const bookings = await Booking.find({ station: stationId }).select('_id');
      const bookingIds = bookings.map(b => b._id);
      filters.booking = { $in: bookingIds };
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const feedbacks = await Feedback.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.max(1, parseInt(limit, 10)))
      .populate('user', 'fullName email')
      .populate({ path: 'booking', populate: [{ path: 'station' }, { path: 'battery' }] });

    const total = await Feedback.countDocuments(filters);

    return res.json({ success: true, data: feedbacks, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) }, message: 'Feedbacks retrieved' });
  } catch (err) {
    console.error('adminListFeedbacks error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: delete feedback by id
const adminDeleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

  const doc = await Feedback.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ success: false, message: 'Feedback not found' });

  return res.json({ success: true, data: doc, message: 'Feedback deleted' });
  } catch (err) {
    console.error('adminDeleteFeedback error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { createFeedback, getAllFeedbacks, getFeedbacksByStation, getMyFeedbackByBooking, adminListFeedbacks, adminDeleteFeedback };
