const { z } = require('zod');
const Transaction = require('../../models/transaction/transaction.model');

const format = (t) => ({
  transaction_id: t.transactionId,
  user_id: t.user?._id?.toString() || t.user?.toString(),
  user_name: t.user?.fullName || null,
  station_id: t.station?.toString(),
  // battery_given: t.battery_given || null,
  // battery_returned: t.battery_returned || null,
  vehicle_id: t.vehicle?.toString() || null,
  battery_id: t.battery?.toString() || null,
  booking_id: t.booking?.toString() || null,
  transaction_time: t.transaction_time,
  cost: t.cost,
});

// Driver: list own transactions
const listMyTransactions = async (req, res) => {
  try {
    const items = await Transaction.find({ user: req.user.id }).sort({ transaction_time: -1 }).limit(200);
    return res.status(200).json({ success: true, data: items.map(format) });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

// Driver: detail
const getMyTransaction = async (req, res) => {
  try {
    const t = await Transaction.findOne({ transactionId: req.params.id, user: req.user.id }).populate('user', 'fullName');
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, data: format(t) });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

// Staff: list by station
const stationQuery = z.object({ stationId: z.string(), limit: z.coerce.number().optional().default(200) });
const listStationTransactions = async (req, res) => {
  try {
    const { stationId, limit } = stationQuery.parse({ stationId: req.query.stationId, limit: req.query.limit });
    const items = await Transaction.find({ station: stationId }).populate('user', 'fullName').sort({ transaction_time: -1 }).limit(limit);
    return res.status(200).json({ success: true, data: items.map(format) });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

// Staff: detail
const getStationTransaction = async (req, res) => {
  try {
    const t = await Transaction.findOne({ transactionId: req.params.id }).populate('user', 'fullName');
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, data: format(t) });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

// Admin: list all with optional filters
const adminQuery = z.object({ user_id: z.string().optional(), station_id: z.string().optional(), limit: z.coerce.number().optional().default(200) });
const listAllTransactions = async (req, res) => {
  try {
    const { user_id, station_id, limit } = adminQuery.parse(req.query);
    const filter = {};
    if (user_id) filter.user = user_id;
    if (station_id) filter.station = station_id;
    const items = await Transaction.find(filter).populate('user', 'fullName').sort({ transaction_time: -1 }).limit(limit);
    return res.status(200).json({ success: true, data: items.map(format) });
  } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

// Admin: detail by transactionId
const getTransaction = async (req, res) => {
  try { const t = await Transaction.findOne({ transactionId: req.params.id }).populate('user', 'fullName'); if (!t) return res.status(404).json({ success: false, message: 'Not found' }); return res.status(200).json({ success: true, data: format(t) }); } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
};

module.exports = { listMyTransactions, getMyTransaction, listStationTransactions, getStationTransaction, listAllTransactions, getTransaction };
