const Battery = require('../../models/battery/battery.model');
const Station = require('../../models/station/station.model');
const { z } = require('zod');

// Admin: create a new battery
exports.createBattery = async (req, res) => {
  try {
    const schema = z.object({
      serial: z.string().min(1),
      model: z.string().optional(),
      soh: z.number().min(0).max(100).optional(),
      status: z.enum(['charging', 'full', 'faulty', 'in-use', 'idle']).optional(),
      stationId: z.string().optional(),
      manufacturer: z.string().optional(),
      capacity_kWh: z.number().min(0).optional(),
      voltage: z.number().min(0).optional(),
    });

    const payload = schema.parse(req.body);

    const batteryData = {
      serial: payload.serial,
      model: payload.model,
      soh: payload.soh,
      status: payload.status,
      manufacturer: payload.manufacturer,
      capacity_kWh: payload.capacity_kWh,
      voltage: payload.voltage,
    };

    if (payload.stationId) {
      const station = await Station.findById(payload.stationId);
      if (!station) return res.status(404).json({ success: false, message: 'Station not found' });
      batteryData.station = station._id;
    }

    const battery = await Battery.create(batteryData);
    return res.status(201).json({ success: true, data: battery });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: err.errors });
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Serial already exists' });
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: get battery by id
exports.getBattery = async (req, res) => {
  try {
    const battery = await Battery.findById(req.params.id).populate('station', 'stationName address');
    if (!battery) return res.status(404).json({ success: false, message: 'Battery not found' });
    return res.json({ success: true, data: battery });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: update battery
exports.updateBattery = async (req, res) => {
  try {
    const schema = z.object({
      model: z.string().optional(),
      soh: z.number().min(0).max(100).optional(),
      status: z.enum(['charging', 'full', 'faulty', 'in-use', 'idle']).optional(),
      stationId: z.string().optional(),
      manufacturer: z.string().optional(),
      capacity_kWh: z.number().min(0).optional(),
      voltage: z.number().min(0).optional(),
    });

    const payload = schema.parse(req.body);

    const update = { ...payload };
    if (payload.stationId) {
      const station = await Station.findById(payload.stationId);
      if (!station) return res.status(404).json({ success: false, message: 'Station not found' });
      update.station = station._id;
      delete update.stationId;
    }

    const battery = await Battery.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!battery) return res.status(404).json({ success: false, message: 'Battery not found' });
    return res.json({ success: true, data: battery });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: err.errors });
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: delete battery
exports.deleteBattery = async (req, res) => {
  try {
    const battery = await Battery.findByIdAndDelete(req.params.id);
    if (!battery) return res.status(404).json({ success: false, message: 'Battery not found' });
    return res.json({ success: true, message: 'Battery deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: list batteries with optional filters
exports.listBatteriesAdmin = async (req, res) => {
  try {
    const { status, stationId, sohMin, sohMax, page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = req.query;
    const query = {};
    if (status) query.status = status;
    if (stationId) query.station = stationId;
    if (sohMin || sohMax) query.soh = {};
    if (sohMin) query.soh.$gte = Number(sohMin);
    if (sohMax) query.soh.$lte = Number(sohMax);

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    const batteries = await Battery.find(query).populate('station', 'stationName address').sort(sortObj).skip(skip).limit(Number(limit));
    const total = await Battery.countDocuments(query);
    return res.json({ success: true, data: batteries, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Public: get all batteries
exports.getModelBatteries = async (req, res) => {
  try {
    const batteries = await Battery.find({}).populate('station', 'stationName address');
    return res.json({ success: true, data: batteries });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
