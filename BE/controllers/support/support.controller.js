const { z, ZodError } = require('zod');
const SupportRequest = require('../../models/support/supportRequest.model');
const Booking = require('../../models/booking/booking.model');

const createSchema = z.object({
  bookingId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const createSupportRequest = async (req, res) => {
  try {
    const body = createSchema.parse(req.body);

    // Find booking and ensure it's completed and belongs to the current user
    const booking = await Booking.findOne({ bookingId: body.bookingId }).populate('battery');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Only allow creating support for bookings that are completed
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Support can only be created for bookings with status "completed"' });
    }

    // Ensure booking belongs to requester (user) unless requester is admin/staff - assume req.user.role may exist
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'staff') {
      if (!booking.user || booking.user.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: booking does not belong to you' });
      }
    }

    const ticketData = {
      user: req.user.id,
      booking: booking._id,
      title: body.title,
      description: body.description,
      images: body.images || [],
    };

    const ticket = await SupportRequest.create(ticketData);
  // Populate booking (and nested battery via booking) in response
  await ticket.populate({ path: 'booking', select: 'bookingId scheduledTime status', populate: { path: 'battery', select: 'serial model soh status manufacturer capacity_kWh voltage' } });

    return res.status(201).json({ success: true, data: ticket, message: 'Support request submitted' });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listSupportRequests = async (req, res) => {
  try {
    const items = await SupportRequest.find({ user: req.user.id })
      .populate({ path: 'booking', select: 'bookingId scheduledTime status', populate: { path: 'battery', select: 'serial model soh status manufacturer capacity_kWh voltage' } })
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createSupportRequest, listSupportRequests };
