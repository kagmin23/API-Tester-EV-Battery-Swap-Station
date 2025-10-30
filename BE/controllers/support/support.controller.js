const { z, ZodError } = require('zod');
const SupportRequest = require('../../models/support/supportRequest.model');
const Booking = require('../../models/booking/booking.model');

const populateForList = () => ({ path: 'booking', select: 'bookingId scheduledTime status', populate: { path: 'battery', select: 'serial model soh status manufacturer capacity_kWh voltage' } });

const createSchema = z.object({
  bookingId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const createSupportRequest = async (req, res) => {
  try {
    const body = createSchema.parse(req.body);

    const booking = await Booking.findOne({ bookingId: body.bookingId }).populate('battery');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Support can only be created for bookings with status "completed"' });
    }

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
      .populate({ path: 'resolvedBy', select: 'fullName email' })
      .populate({ path: 'closedBy', select: 'fullName email' })
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const adminListAllSupportRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const items = await SupportRequest.find(filter)
      .populate(populateForList())
      .populate({ path: 'user', select: 'fullName email phoneNumber' })
      .populate({ path: 'resolvedBy', select: 'fullName email' })
      .populate({ path: 'closedBy', select: 'fullName email' })
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getSupportRequestsByStation = async (req, res) => {
  try {
    const stationId = req.params.id;

    if (req.user && req.user.role === 'staff') {
      const User = require('../../models/auth/auth.model');
      const staff = await User.findById(req.user.id).select('station');
      const staffStation = staff ? staff.station : null;
      if (!staffStation || staffStation.toString() !== stationId) {
        return res.status(403).json({ success: false, message: 'Forbidden: not assigned to this station' });
      }
    }

    // Find bookings for the station
    const bookings = await Booking.find({ station: stationId }).select('_id');
    const bookingIds = bookings.map(b => b._id);

    const items = await SupportRequest.find({ booking: { $in: bookingIds } })
      .populate(populateForList())
      .populate({ path: 'user', select: 'fullName email phoneNumber' })
      .populate({ path: 'resolvedBy', select: 'fullName email' })
      .populate({ path: 'closedBy', select: 'fullName email' })
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const resolveSupportRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await SupportRequest.findById(id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found' });
    if (ticket.status !== 'in-progress') {
      return res.status(400).json({ success: false, message: 'Only in-progress requests can be resolved' });
    }

    const note = (req.body && typeof req.body.resolveNote === 'string') ? req.body.resolveNote.trim() : null;
    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();
    ticket.resolveNote = note;
    ticket.resolvedBy = req.user && req.user.id ? req.user.id : null;
    await ticket.save();
    await ticket.populate(populateForList());
    await ticket.populate({ path: 'resolvedBy', select: 'fullName email' });
    return res.status(200).json({ success: true, data: ticket, message: 'Support request marked as resolved' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const completeSupportRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await SupportRequest.findById(id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found' });

    if (!ticket.user || ticket.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the ticket owner can mark it completed' });
    }

    if (ticket.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Only resolved requests can be completed' });
    }

    ticket.status = 'completed';
    ticket.completedAt = new Date();
    await ticket.save();
    await ticket.populate(populateForList());
    return res.status(200).json({ success: true, data: ticket, message: 'Support request marked as completed' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const closeSupportRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await SupportRequest.findById(id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found' });

    // allow closing when ticket is either 'resolved' or 'completed'
    if (!['resolved', 'completed'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Only resolved or completed requests can be closed by staff/admin' });
    }

    const note = (req.body && typeof req.body.closeNote === 'string') ? req.body.closeNote.trim() : null;
    if (!note) {
      return res.status(400).json({ success: false, message: 'closeNote is required when closing a support request' });
    }

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closeNote = note;
    ticket.closedBy = req.user && req.user.id ? req.user.id : null;
    await ticket.save();
    await ticket.populate(populateForList());
    await ticket.populate({ path: 'resolvedBy', select: 'fullName email' });
    await ticket.populate({ path: 'closedBy', select: 'fullName email' });
    return res.status(200).json({ success: true, data: ticket, message: 'Support request marked as closed' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createSupportRequest, listSupportRequests, adminListAllSupportRequests, resolveSupportRequest, completeSupportRequest, closeSupportRequest, getSupportRequestsByStation };
