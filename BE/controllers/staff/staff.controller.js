const Station = require('../../models/station/station.model');
const Battery = require('../../models/battery/battery.model');
const BatteryHistory = require('../../models/battery/batteryHistory.model');
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

// Placeholders for swap requests and returns (details depend on later models)
const listSwapRequests = async (req, res) => {
  return res.status(200).json({ success: true, data: [], message: 'Not implemented: depends on swap models' });
};
const confirmSwapRequest = async (req, res) => { return res.status(200).json({ success: true, data: null, message: 'Swap confirmed (demo)' }); };
const recordSwapReturn = async (req, res) => { return res.status(200).json({ success: true, data: null, message: 'Swap return recorded (demo)' }); };

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
