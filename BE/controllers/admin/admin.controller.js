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
    const staff = await User.find({ role: 'staff', station: st._id }).select('-password');
    return res.status(200).json({ success: true, data: { station: st, batteries, staff } });
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

// List all batteries with filters and pagination (admin)
const listBatteriesQuery = z.object({
  status: z.enum(["charging", "full", "faulty", "in-use", "idle"]).optional(),
  stationId: z.string().optional(),
  sohMin: z.coerce.number().min(0).max(100).optional(),
  sohMax: z.coerce.number().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(["createdAt", "updatedAt", "soh"]).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});
const listBatteries = async (req, res) => {
  try {
    const q = listBatteriesQuery.parse(req.query);
    const filter = {};
    if (q.status) filter.status = q.status;
    if (q.stationId) filter.station = q.stationId;
    if (q.sohMin !== undefined || q.sohMax !== undefined) {
      filter.soh = {};
      if (q.sohMin !== undefined) filter.soh.$gte = q.sohMin;
      if (q.sohMax !== undefined) filter.soh.$lte = q.sohMax;
    }
    const skip = (q.page - 1) * q.limit;
    const sortObj = { [q.sort]: q.order === "asc" ? 1 : -1 };
    const [items, total] = await Promise.all([
      Battery.find(filter)
        .populate("station", "stationName address")
        .sort(sortObj)
        .skip(skip)
        .limit(q.limit),
      Battery.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total,
        page: q.page,
        limit: q.limit,
        pages: Math.ceil(total / q.limit),
      },
    });
  } catch (err) {
    if (err instanceof ZodError)
      return res
        .status(400)
        .json({ success: false, message: err.errors?.[0]?.message || "Invalid query" });
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
  stationId: z.string().optional(),
});
const upsertStaff = async (req, res) => {
  try {
    const body = upsertStaffSchema.parse(req.body);
    let user;
    if (req.params.id) {
      // Update existing staff by id
      user = await User.findById(req.params.id);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "Staff not found" });

      // Ensure role is staff (do not allow editing admins via this endpoint)
      if (user.role !== "staff")
        return res
          .status(400)
          .json({ success: false, message: "Target user is not staff" });

      // Handle potential email/phone uniqueness changes
      if (user.email !== body.email) {
        const emailTaken = await User.findOne({ email: body.email });
        if (emailTaken && emailTaken._id.toString() !== user._id.toString()) {
          return res
            .status(409)
            .json({ success: false, message: "Email already in use" });
        }
        user.email = body.email;
      }
      if (user.phoneNumber !== body.phoneNumber) {
        const phoneTaken = await User.findOne({ phoneNumber: body.phoneNumber });
        if (phoneTaken && phoneTaken._id.toString() !== user._id.toString()) {
          return res
            .status(409)
            .json({ success: false, message: "Phone number already in use" });
        }
        user.phoneNumber = body.phoneNumber;
      }
      user.fullName = body.fullName;
      if (body.password) user.password = body.password; // hashed by pre-save
      // Keep role and verification
      user.role = "staff";
      user.isVerified = true;
      // Assign station if provided
      if (body.stationId) {
        const st = await Station.findById(body.stationId);
        if (!st) return res.status(400).json({ success: false, message: 'Invalid stationId' });
        user.station = st._id;
      }
      await user.save();
    } else {
      // Create staff by email (no verification needed)
      const exists = await User.findOne({ $or: [{ email: body.email }, { phoneNumber: body.phoneNumber }] });
      if (exists) {
        return res
          .status(409)
          .json({ success: false, message: "Email or phone already in use" });
      }
      user = new User({
        email: body.email,
        fullName: body.fullName,
        phoneNumber: body.phoneNumber,
        password: body.password || body.phoneNumber,
        role: "staff",
        isVerified: true,
        status: 'active',
        station: null,
      });
      if (body.stationId) {
        const st = await Station.findById(body.stationId);
        if (!st) return res.status(400).json({ success: false, message: 'Invalid stationId' });
        user.station = st._id;
      }
      await user.save();
    }
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

// Assign one or multiple staff members to a station (admin only)
const assignStaffToStationSchema = z.object({
  staffIds: z.array(z.string()).optional(),
  staffId: z.string().optional(),
});
const assignStaffToStation = async (req, res) => {
  try {
    const { id } = req.params; // station id
    const body = assignStaffToStationSchema.parse(req.body);
    const station = await Station.findById(id);
    if (!station) return res.status(404).json({ success: false, message: 'Station not found' });

    const ids = (body.staffIds && body.staffIds.length) ? body.staffIds : (body.staffId ? [body.staffId] : []);
    if (!ids.length) return res.status(400).json({ success: false, message: 'Provide staffId or staffIds' });

    // Fetch users and validate
    const users = await User.find({ _id: { $in: ids } });
    const missing = ids.filter(i => !users.some(u => u._id.toString() === i));
    if (missing.length) return res.status(404).json({ success: false, message: `Users not found: ${missing.join(',')}` });

    const notStaff = users.filter(u => u.role !== 'staff').map(u => u._id.toString());
    if (notStaff.length) return res.status(400).json({ success: false, message: `Users are not staff: ${notStaff.join(',')}` });

    // Assign station to the staff members
    await User.updateMany({ _id: { $in: ids } }, { $set: { station: station._id } });
    const updated = await User.find({ _id: { $in: ids } }).select('-password');
    return res.status(200).json({ success: true, data: updated, message: 'Staff assigned to station' });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Remove staff from station (admin only)
const removeStaffFromStation = async (req, res) => {
  try {
    const { id: stationId, staffId } = req.params;

    // Check if station exists
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    // Check if staff exists and is assigned to this station
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    if (staff.role !== 'staff') {
      return res.status(400).json({ success: false, message: 'User is not a staff member' });
    }

    if (staff.station?.toString() !== stationId) {
      return res.status(400).json({ success: false, message: 'Staff is not assigned to this station' });
    }

    // Remove staff from station
    staff.station = null;
    await staff.save();

    return res.status(200).json({
      success: true,
      data: {
        staffId: staff._id,
        stationId: stationId,
        message: 'Staff removed from station successfully'
      },
      message: 'Staff removed from station'
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Delete staff account by id (admin only)
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });
    if (user.role !== 'staff')
      return res.status(400).json({ success: false, message: 'Target user is not staff' });
    await User.deleteOne({ _id: id });
    return res.status(200).json({ success: true, data: null, message: 'Staff deleted' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Change user status (driver or staff) to active/locked
const changeUserStatusSchema = z.object({ status: z.enum(['active', 'locked']) });
const changeUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = changeUserStatusSchema.parse(req.body);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'driver' && user.role !== 'staff') {
      return res.status(400).json({ success: false, message: 'Only driver or staff status can be updated' });
    }
    user.status = status;
    // If locking account, also invalidate refresh token
    if (status === 'locked') {
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
    }
    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;
    return res.status(200).json({ success: true, data: sanitized, message: 'User status updated' });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Admin: change user role
const changeUserRoleSchema = z.object({ role: z.enum(["admin", "driver", "staff"]) });
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const body = changeUserRoleSchema.parse(req.body);
    const user = await User.findById(id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });
    user.role = body.role;
    await user.save();
    const sanitized = user.toObject();
    delete sanitized.password;
    return res.status(200).json({ success: true, data: sanitized, message: "User role updated" });
  } catch (err) {
    if (err instanceof ZodError)
      return res.status(400).json({ success: false, message: err.errors?.[0]?.message || "Invalid input" });
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
  listBatteries,
  deleteStaff,
  listPlans,
  upsertPlan,
  reportsOverview,
  reportsUsage,
  aiPredictions,
  createStation,
  changeUserRole,
  changeUserStatus,
  assignStaffToStation,
  removeStaffFromStation,
};
