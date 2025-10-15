const Station = require("../../models/station/station.model");
const Battery = require("../../models/battery/battery.model");
const Complaint = require("../../models/complaint/complaint.model");
const SubscriptionPlan = require("../../models/subscription/subscriptionPlan.model");
const User = require("../../models/auth/auth.model");
const { z, ZodError } = require("zod");

const listStations = async (req, res) => {
  try {
    const items = await Station.find({});
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getStation = async (req, res) => {
  try {
    const st = await Station.findById(req.params.id);
    if (!st)
      return res.status(404).json({ success: false, message: "Not found" });
    const batteries = await Battery.find({ station: st._id });
    return res
      .status(200)
      .json({ success: true, data: { station: st, batteries } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const transferSchema = z.object({
  fromStationId: z.string(),
  toStationId: z.string(),
  batteryIds: z.array(z.string()).min(1),
});
const transferBatteries = async (req, res) => {
  try {
    const body = transferSchema.parse(req.body);
    await Battery.updateMany(
      { _id: { $in: body.batteryIds } },
      { $set: { station: body.toStationId, status: "idle" } }
    );
    return res
      .status(200)
      .json({ success: true, data: null, message: "Batteries transferred" });
  } catch (err) {
    if (err instanceof ZodError)
      return res
        .status(400)
        .json({
          success: false,
          message: err.errors?.[0]?.message || "Invalid input",
        });
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listFaultyBatteries = async (req, res) => {
  try {
    const items = await Battery.find({ status: "faulty" });
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listComplaints = async (req, res) => {
  try {
    const items = await Complaint.find({}).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
const resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const c = await Complaint.findById(id);
    if (!c)
      return res.status(404).json({ success: false, message: "Not found" });
    c.status = "resolved";
    c.response = response || c.response;
    await c.save();
    return res
      .status(200)
      .json({ success: true, data: c, message: "Complaint resolved" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listCustomers = async (req, res) => {
  try {
    const items = await User.find({ role: "driver" }).select("-password");
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
const getCustomer = async (req, res) => {
  try {
    const item = await User.findById(req.params.id).select("-password");
    if (!item)
      return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listStaff = async (req, res) => {
  try {
    const items = await User.find({ role: "staff" }).select("-password");
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
const upsertStaffSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phoneNumber: z.string().regex(/^0\d{9}$/),
  password: z.string().min(6).optional(),
});
const upsertStaff = async (req, res) => {
  try {
    const body = upsertStaffSchema.parse(req.body);
    let user = await User.findOne({ email: body.email });
    if (!user) {
      user = new User({
        email: body.email,
        fullName: body.fullName,
        phoneNumber: body.phoneNumber,
        password: body.password || body.phoneNumber,
        role: "staff",
        isVerified: true,
      });
    } else {
      user.fullName = body.fullName;
      const changeRoleSchema = z.object({ role: z.enum(['admin','driver','staff']) });
      const changeUserRole = async (req, res) => {
        try {
          const { id } = req.params;
          const { role } = changeRoleSchema.parse(req.body);
          const user = await User.findById(id);
          if (!user) return res.status(404).json({ success: false, message: 'User not found' });
          user.role = role;
          await user.save();
          const sanitized = user.toObject(); delete sanitized.password;
          return res.status(200).json({ success: true, data: sanitized, message: 'Role updated' });
        } catch (err) {
          if (err instanceof ZodError) return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
          return res.status(400).json({ success: false, message: err.message });
        }
      };
      user.phoneNumber = body.phoneNumber;
      user.role = "staff";
      if (body.password) user.password = body.password;
    }
    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;
    return res
      .status(200)
      .json({ success: true, data: sanitized, message: "Staff upserted" });
  } catch (err) {
    if (err instanceof ZodError)
      return res
        .status(400)
        .json({
          success: false,
          message: err.errors?.[0]?.message || "Invalid input",
        });
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listPlans = async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const items = await SubscriptionPlan.find({ status });
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
const upsertPlanSchema = z.object({
  // New fields
  subcriptionName: z.string().min(2).optional(),
  price: z.number().positive(),
  period: z.enum(["monthly", "yearly"]).optional(),
  benefits: z.array(z.string()).optional(),
  status: z.enum(["active", "expired"]).optional(),
  duration_months: z.number().int().min(1).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  // Backward-compat
  name: z.string().min(2).optional(),
  active: z.boolean().optional(),
});
const upsertPlan = async (req, res) => {
  try {
    const body = upsertPlanSchema.parse(req.body);
    // Map legacy fields if provided
    const payload = { ...body };
    if (body.name && !body.subcriptionName) payload.subcriptionName = body.name;
    if (typeof body.active === 'boolean' && !body.status) payload.status = body.active ? 'active' : 'expired';

    let plan;
    if (req.params.id) {
      plan = await SubscriptionPlan.findByIdAndUpdate(
        req.params.id,
        { $set: payload },
        { new: true }
      );
    } else {
      plan = await SubscriptionPlan.create(payload);
    }
    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    if (err instanceof ZodError)
      return res
        .status(400)
        .json({
          success: false,
          message: err.errors?.[0]?.message || "Invalid input",
        });
    return res.status(400).json({ success: false, message: err.message });
  }
};

const reportsOverview = async (req, res) => {
  return res
    .status(200)
    .json({ success: true, data: { revenue: 0, swaps: 0 } });
};
const reportsUsage = async (req, res) => {
  return res
    .status(200)
    .json({ success: true, data: { frequency: [], peakHours: [] } });
};
const aiPredictions = async (req, res) => {
  return res
    .status(200)
    .json({
      success: true,
      data: { suggest: "Add batteries to high-demand stations (demo)" },
    });
};

const createStationSchema = z.object({
  stationName: z.string().min(2),
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  map_url: z.string().url().optional(),
  capacity: z.number().int().min(0).optional(),
  lat: z.number(),
  lng: z.number(),
});
const createStation = async (req, res) => {
  try {
    const body = createStationSchema.parse(req.body);
    const station = await Station.create({
      stationName: body.stationName,
      address: body.address,
      city: body.city,
      district: body.district,
      map_url: body.map_url,
      capacity: body.capacity ?? 0,
      sohAvg: 100,
      availableBatteries: 0,
      location: { type: 'Point', coordinates: [body.lng, body.lat] },
    });
    return res.status(201).json({ success: true, data: station, message: 'Station created' });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  listStations,
  getStation,
  transferBatteries,
  listFaultyBatteries,
  listComplaints,
  resolveComplaint,
  listCustomers,
  getCustomer,
  listStaff,
  upsertStaff,
  listPlans,
  upsertPlan,
  reportsOverview,
  reportsUsage,
  aiPredictions,
  createStation,
  changeUserRole,
};
