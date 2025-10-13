const { z, ZodError } = require('zod');
const Booking = require('../../models/booking/booking.model');
const Station = require('../../models/station/station.model');

const createSchema = z.object({ station_id: z.string(), scheduled_time: z.coerce.date(), notes: z.string().optional() });

const createBooking = async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const station = await Station.findById(body.station_id);
    if (!station) return res.status(404).json({ success: false, message: 'Station not found' });

    const booking = await Booking.create({
      user: req.user.id,
      station: station._id,
      scheduledTime: body.scheduled_time,
      status: 'pending',
      notes: body.notes,
    });

    return res.status(201).json({
      success: true,
      data: {
        booking_id: booking.bookingId,
        user_id: booking.user.toString(),
        station_id: booking.station.toString(),
        scheduled_time: booking.scheduledTime,
        status: booking.status,
      },
      message: 'Booking created',
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).sort({ createdAt: -1 });
    const data = bookings.map(b => ({
      booking_id: b.bookingId,
      user_id: b.user.toString(),
      station_id: b.station.toString(),
      scheduled_time: b.scheduledTime,
      status: b.status,
      created_at: b.createdAt,
    }));
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await Booking.findOne({ bookingId: id, user: req.user.id });
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (b.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending bookings can be cancelled' });
    b.status = 'cancelled';
    await b.save();
    return res.status(200).json({ success: true, data: null, message: 'Booking cancelled' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getBookingDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await Booking.findOne({ bookingId: id, user: req.user.id });
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });
    return res.status(200).json({ success: true, data: {
      booking_id: b.bookingId,
      user_id: b.user.toString(),
      station_id: b.station.toString(),
      scheduled_time: b.scheduledTime,
      status: b.status,
      created_at: b.createdAt,
      notes: b.notes,
    } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createBooking, listBookings, cancelBooking, getBookingDetail };
