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
      status: z.enum(['charging', 'full', 'faulty', 'in-use', 'idle', 'is-booking']).optional(),
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
      status: z.enum(['charging', 'full', 'faulty', 'in-use', 'idle', 'is-booking']).optional(),
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

// Public: get all batteries in a specific station
exports.getBatteriesByStation = async (req, res) => {
  try {
    const { stationId } = req.params;

    // Validate station exists
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    // Get all batteries in this station
    const batteries = await Battery.find({ station: stationId })
      .populate('station', 'stationName address city district')
      .sort({ status: 1, soh: -1 }); // Sort by status first, then by SOH descending

    // Group batteries by status for better organization
    const groupedBatteries = {
      available: batteries.filter(b => b.status === 'idle' || b.status === 'full'),
      charging: batteries.filter(b => b.status === 'charging'),
      inUse: batteries.filter(b => b.status === 'in-use'),
      faulty: batteries.filter(b => b.status === 'faulty')
    };

    // Calculate statistics
    const stats = {
      total: batteries.length,
      available: groupedBatteries.available.length,
      charging: groupedBatteries.charging.length,
      inUse: groupedBatteries.inUse.length,
      faulty: groupedBatteries.faulty.length,
      averageSoh: batteries.length > 0 ?
        Math.round(batteries.reduce((sum, b) => sum + b.soh, 0) / batteries.length) : 0
    };

    return res.json({
      success: true,
      data: {
        station: {
          id: station._id,
          name: station.stationName,
          address: station.address,
          city: station.city,
          district: station.district
        },
        batteries: batteries,
        grouped: groupedBatteries,
        statistics: stats
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Admin: Update battery counts for a specific station
exports.updateStationBatteryCounts = async (req, res) => {
  try {
    const { stationId } = req.params;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    const updatedStation = await station.updateBatteryCounts();

    return res.json({
      success: true,
      data: {
        station: {
          id: updatedStation._id,
          name: updatedStation.stationName,
          capacity: updatedStation.capacity,
          sohAvg: updatedStation.sohAvg
        },
        batteryCounts: updatedStation.batteryCounts,
        availableBatteries: updatedStation.availableBatteries
      },
      message: 'Battery counts updated successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Admin: Update battery counts for all stations
exports.updateAllStationsBatteryCounts = async (req, res) => {
  try {
    const updatedStations = await Station.updateAllBatteryCounts();

    const summary = updatedStations.map(station => ({
      id: station._id,
      name: station.stationName,
      batteryCounts: station.batteryCounts,
      sohAvg: station.sohAvg
    }));

    return res.json({
      success: true,
      data: {
        updatedStations: summary,
        totalStations: updatedStations.length
      },
      message: 'All stations battery counts updated successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Public: Get station battery management info
exports.getStationBatteryManagement = async (req, res) => {
  try {
    const { stationId } = req.params;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    // Get detailed battery information
    const batteries = await Battery.find({ station: stationId })
      .sort({ status: 1, soh: -1 });

    // Calculate utilization percentage
    const utilizationPercentage = station.capacity > 0 ?
      Math.round((station.batteryCounts.total / station.capacity) * 100) : 0;

    // Calculate health score based on SOH and status
    const healthScore = station.batteryCounts.total > 0 ?
      Math.round((station.sohAvg * 0.7) +
        ((station.batteryCounts.available / station.batteryCounts.total) * 30)) : 0;

    return res.json({
      success: true,
      data: {
        station: {
          id: station._id,
          name: station.stationName,
          address: station.address,
          city: station.city,
          district: station.district
        },
        capacity: {
          maxCapacity: station.capacity,
          currentTotal: station.batteryCounts.total,
          utilizationPercentage: utilizationPercentage,
          availableSlots: station.capacity - station.batteryCounts.total
        },
        batteryCounts: station.batteryCounts,
        health: {
          averageSoh: station.sohAvg,
          healthScore: healthScore,
          status: healthScore >= 80 ? 'Excellent' :
            healthScore >= 60 ? 'Good' :
              healthScore >= 40 ? 'Fair' : 'Poor'
        },
        batteries: batteries,
        lastUpdated: station.updatedAt
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};