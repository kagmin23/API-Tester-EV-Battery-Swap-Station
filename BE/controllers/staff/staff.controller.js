const Station = require('../../models/station/station.model');
const Battery = require('../../models/battery/battery.model');
const BatteryHistory = require('../../models/battery/batteryHistory.model');
const Booking = require('../../models/booking/booking.model');
const Payment = require('../../models/payment/payment.model');
const { z, ZodError } = require('zod');
const User = require('../../models/auth/auth.model');

const dashboard = async (req, res) => {
  try {
    const { stationId } = req.params;
    const station = await Station.findById(stationId);
    if (!station) return res.status(404).json({ success: false, message: 'Station not found' });
    const agg = await Battery.aggregate([
      { $match: { station: station._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return res.status(200).json({ success: true, data: { station, batteryStatus: agg } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listStationBatteries = async (req, res) => {
  try {
    const { stationId } = req.params;
    const items = await Battery.find({ station: stationId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

const batteryDetail = async (req, res) => {
  try { const item = await Battery.findById(req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Not found' }); return res.status(200).json({ success: true, data: item }); } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

const batteryHistory = async (req, res) => {
  try { const his = await BatteryHistory.find({ battery: req.params.id }).sort({ createdAt: -1 }); return res.status(200).json({ success: true, data: his }); } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

const updateBatterySchema = z.object({ status: z.enum(['charging','full','faulty','in-use','idle']).optional(), soh: z.number().min(0).max(100).optional() });
const updateBattery = async (req, res) => {
  try {
    const body = updateBatterySchema.parse(req.body);
    const b = await Battery.findById(req.params.id);
    if (!b) return res.status(404).json({ success: false, message: 'Not found' });
    if (body.status !== undefined) b.status = body.status;
    if (body.soh !== undefined) b.soh = body.soh;
    await b.save();
    await BatteryHistory.create({ battery: b._id, station: b.station, action: 'repair', soh: b.soh, details: `Update status/soh by staff ${req.user.id}` });
    return res.status(200).json({ success: true, data: b, message: 'Battery updated' });
  } catch (err) {
    if (err instanceof ZodError) { return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' }); }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listSwapRequests = async (req, res) => {
  try {
    let stationId = null;

    if (req.user && req.user.role === 'staff') {
      stationId = req.user.station;

      if (!stationId) {
        const staffUser = await User.findById(req.user.id).select('station role');
        if (!staffUser)
          return res.status(401).json({ success: false, message: 'Unauthorized' });
        if (staffUser.role !== 'staff')
          return res.status(403).json({ success: false, message: 'Forbidden' });
        stationId = staffUser.station;
        if (!stationId)
          return res
            .status(400)
            .json({ success: false, message: 'Staff not assigned to a station' });
      }
    } else {
      // Admin or others: can query via stationId
      stationId = req.query.stationId || null;
    }

    // Remove status filter to get all bookings
    const filter = {};
    if (stationId) filter.station = stationId;

    // Fetch bookings and related info
    const bookings = await Booking.find(filter)
      .populate('user', 'fullName phoneNumber')
      .populate(
        'battery',
        'serial model soh status manufacturer capacity_kWh voltage'
      )
      .populate('station', 'stationName address city district')
      .sort({ createdAt: -1 });

    const data = bookings.map((b) => ({
      booking_id: b.bookingId,
      user: b.user
        ? {
            id: b.user._id,
            name: b.user.fullName,
            phone: b.user.phoneNumber,
          }
        : null,
      vehicle_id: b.vehicle ? b.vehicle.toString() : null,
      station_id: b.station ? b.station._id.toString() : null,
      station_name: b.station ? b.station.stationName : null,
      battery_id: b.battery ? b.battery._id.toString() : null,
      battery_info: b.battery
        ? {
            serial: b.battery.serial,
            model: b.battery.model,
            soh: b.battery.soh,
            status: b.battery.status,
            manufacturer: b.battery.manufacturer,
            price: b.battery.price,
            capacity_kWh: b.battery.capacity_kWh,
            voltage: b.battery.voltage,
          }
        : null,
      scheduled_time: b.scheduledTime,
      status: b.status,
      created_at: b.createdAt,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const confirmSwapSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'completed']).optional(),
});

const confirmSwapRequest = async (req, res) => {
  try {
    const body = confirmSwapSchema.parse(req.body || {});
    const requestedStatus = body.status || 'confirmed';
    const { id } = req.params;

    // pending → confirmed / cancelled
    // ready → completed
    const filter = {
      bookingId: id,
      status:
        requestedStatus === 'completed'
          ? 'ready'
          : 'pending',
    };

    // Staff-only filter by station
    if (req.user && req.user.role === 'staff') {
      let staffStation = req.user.station;
      if (!staffStation) {
        const staffUser = await User.findById(req.user.id).select('station role');
        if (!staffUser)
          return res.status(401).json({ success: false, message: 'Unauthorized' });
        if (staffUser.role !== 'staff')
          return res.status(403).json({ success: false, message: 'Forbidden' });
        staffStation = staffUser.station;
      }
      if (!staffStation)
        return res.status(400).json({ success: false, message: 'Staff not assigned to a station' });
      filter.station = staffStation;
    }

    const booking = await Booking.findOne(filter);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found or invalid status transition' });

    booking.status = requestedStatus;
    await booking.save();

    // Update battery status + history
    if (booking.battery) {
      if (requestedStatus === 'confirmed') {
        await Battery.findByIdAndUpdate(booking.battery, { status: 'in-use' });
        await BatteryHistory.create({
          battery: booking.battery,
          station: booking.station,
          action: 'swap',
          soh: null,
          details: `Swap confirmed by staff ${req.user.id}`,
        });
      } else if (requestedStatus === 'cancelled') {
        await Battery.findByIdAndUpdate(booking.battery, { status: 'idle' });
        await BatteryHistory.create({
          battery: booking.battery,
          station: booking.station,
          action: 'cancel',
          soh: null,
          details: `Swap cancelled by staff ${req.user.id}`,
        });
      } else if (requestedStatus === 'completed') {
        await Battery.findByIdAndUpdate(booking.battery, { status: 'in-use' });
        await BatteryHistory.create({
          battery: booking.battery,
          station: booking.station,
          action: 'return',
          soh: null,
          details: `Swap completed by staff ${req.user.id}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: null,
      message: `Swap ${requestedStatus}`,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: err.errors?.[0]?.message || 'Invalid input',
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const recordSwapReturn = async (req, res) => {
  try {
    const { id } = req.params; // bookingId
    const filter = { bookingId: id, status: 'confirmed' };
    if (req.user && req.user.role === 'staff') {
      let staffStation = req.user.station;
      if (!staffStation) {
        const staffUser = await User.findById(req.user.id).select('station role');
        if (!staffUser) return res.status(401).json({ success: false, message: 'Unauthorized' });
        if (staffUser.role !== 'staff') return res.status(403).json({ success: false, message: 'Forbidden' });
        staffStation = staffUser.station;
      }
      if (!staffStation) return res.status(400).json({ success: false, message: 'Staff not assigned to a station' });
      filter.station = staffStation;
    }

    const booking = await Booking.findOne(filter);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not in confirmed state' });

    booking.status = 'completed';
    await booking.save();

    if (booking.battery) {
      // mark battery as idle (or charging depending on workflow)
      await Battery.findByIdAndUpdate(booking.battery, { status: 'idle' });
      await BatteryHistory.create({ battery: booking.battery, station: booking.station, action: 'return', soh: null, details: `Swap return recorded by staff ${req.user.id}` });
    }

    return res.status(200).json({ success: true, data: null, message: 'Swap return recorded' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const stationPaymentSchema = z.object({ stationId: z.string(), amount: z.number().positive(), bookingId: z.string().optional() });
const createStationPayment = async (req, res) => {
  try {
    const body = stationPaymentSchema.parse(req.body);
    const pay = await Payment.create({ method: 'cash', station: body.stationId, user: req.user.id, amount: body.amount, booking: body.bookingId, status: 'success' });
    return res.status(201).json({ success: true, data: pay, message: 'Payment recorded' });
  } catch (err) {
    if (err instanceof ZodError) { return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' }); }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const stationSwapHistory = async (req, res) => {
  return res.status(200).json({ success: true, data: [], message: 'Not implemented: depends on swap models' });
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('station', 'stationName address city district location');
    if (!user || user.role !== 'staff') return res.status(403).json({ success: false, message: 'Forbidden' });
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { dashboard, listStationBatteries, batteryDetail, batteryHistory, updateBattery, listSwapRequests, confirmSwapRequest, recordSwapReturn, createStationPayment, stationSwapHistory, me };
