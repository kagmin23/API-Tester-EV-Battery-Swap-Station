const Station = require("../../models/station/station.model");
const Battery = require("../../models/battery/battery.model");
const Complaint = require("../../models/complaint/complaint.model");
const SubscriptionPlan = require("../../models/subscription/subscriptionPlan.model");
const User = require("../../models/auth/auth.model");
const UserSubscription = require('../../models/subscription/userSubscription.model');
const { z, ZodError } = require("zod");

const listStations = async (req, res) => {
  try {
    const items = await Station.find({});
    // Update battery counts and SOH for all stations to get real-time data
    const updatedItems = [];
    for (const station of items) {
      const updated = await station.updateBatteryCounts();
      updatedItems.push(updated);
    }
    return res.status(200).json({ success: true, data: updatedItems });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getStation = async (req, res) => {
  try {
    const st = await Station.findById(req.params.id);
    if (!st)
      return res.status(404).json({ success: false, message: "Not found" });
    // Update battery counts and SOH to get real-time data
    await st.updateBatteryCounts();
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
    const items = await User.find({ role: "driver" }).select("-password").lean();

    // attach active subscription (if any) to each user
    const userIds = items.map(u => u._id);
    const subs = await require('../../models/subscription/userSubscription.model').find({ user: { $in: userIds }, status: 'active' }).lean();
    // populate plan details for subscriptions
    const planIdsFromSubs = subs.map(s => s.plan).filter(Boolean).map(String);
    const uniquePlanIds = Array.from(new Set(planIdsFromSubs));
    const planDocs = uniquePlanIds.length ? await SubscriptionPlan.find({ _id: { $in: uniquePlanIds } }).lean() : [];
  const planMapBySubs = planDocs.reduce((acc, p) => (acc[p._id.toString()] = p, acc), {});

    const subsByUser = subs.reduce((acc, s) => {
      acc[s.user.toString()] = acc[s.user.toString()] || [];
  const planDoc = planMapBySubs[s.plan?.toString()];
      acc[s.user.toString()].push({
        id: s._id,
        plan: planDoc ? { id: planDoc._id, subscriptionName: planDoc.subscriptionName, description: planDoc.description, price: planDoc.price, durations: planDoc.durations } : s.plan,
        start_date: s.start_date,
        end_date: s.end_date,
        remaining_swaps: s.remaining_swaps,
        status: s.status,
      });
      return acc;
    }, {});

    const enhanced = items.map(u => ({
      ...u,
      subscriptions: subsByUser[u._id.toString()] || [],
    }));

    // also return counts per plan for admin overview
    const usageAgg = await require('../../models/subscription/userSubscription.model').aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);
    // populate plan details
    const planIds = usageAgg.map(a => a._id).filter(Boolean);
    const plans = await SubscriptionPlan.find({ _id: { $in: planIds } }).lean();
    const planMap = plans.reduce((acc, p) => (acc[p._id.toString()] = p, acc), {});
    const planUsage = usageAgg.map(a => ({ plan: planMap[a._id.toString()] || { id: a._id }, count: a.count }));

    return res.status(200).json({ success: true, data: enhanced, planUsage });
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
      
      // ✅ Validation: Check if station is being changed and old station has active bookings
      if (body.stationId) {
        const st = await Station.findById(body.stationId);
        if (!st) return res.status(400).json({ success: false, message: 'Invalid stationId' });
        
        // Check if staff is being transferred from another station
        const oldStationId = user.station;
        const isChangingStation = oldStationId && oldStationId.toString() !== body.stationId;
        
        if (isChangingStation) {
          console.log('🔍 [UPSERT STAFF VALIDATION] Staff is changing station from', oldStationId.toString(), 'to', body.stationId);
          
          // Count batteries with 'is-booking' status at old station
          const bookingBatteriesCount = await Battery.countDocuments({
            station: oldStationId,
            status: 'is-booking'
          });
          
          console.log('🔍 [UPSERT STAFF VALIDATION] Old station booking batteries count:', bookingBatteriesCount);
          
          // If old station has batteries with active bookings
          if (bookingBatteriesCount > 0) {
            // Count remaining staff at old station (excluding this staff)
            // ✅ Only count ACTIVE staff (not locked/suspended)
            const remainingStaffCount = await User.countDocuments({
              role: 'staff',
              station: oldStationId,
              _id: { $ne: user._id },
              status: 'active'  // Only count active staff who can handle bookings
            });
            
            console.log('🔍 [UPSERT STAFF VALIDATION] Remaining staff count at old station:', remainingStaffCount);
            
            // If no staff will remain at old station, block the update
            if (remainingStaffCount === 0) {
              const oldStation = await Station.findById(oldStationId);
              
              // Check if there are locked/inactive staff at the station
              const totalStaffCount = await User.countDocuments({
                role: 'staff',
                station: oldStationId,
                _id: { $ne: user._id }
              });
              const lockedStaffCount = totalStaffCount - remainingStaffCount;
              
              let message = `Cannot transfer staff "${user.fullName}" from station "${oldStation?.stationName}". That station has ${bookingBatteriesCount} battery(ies) with active bookings and this staff member is the only active one assigned.`;
              
              if (lockedStaffCount > 0) {
                message += ` (Note: ${lockedStaffCount} other staff member(s) at this station are locked/inactive and cannot handle bookings)`;
              }
              
              message += ' Please assign another active staff member to that station first or wait for bookings to be completed.';
              
              console.error('❌ [UPSERT STAFF VALIDATION] BLOCKING TRANSFER - No active staff will remain at old station with active bookings');
              console.error(`   Total staff: ${totalStaffCount + 1}, Active staff: 1, Locked staff: ${lockedStaffCount}`);
              
              return res.status(400).json({
                success: false,
                message,
                details: {
                  staffName: user.fullName,
                  oldStationName: oldStation?.stationName,
                  oldStationId: oldStationId,
                  newStationName: st.stationName,
                  newStationId: body.stationId,
                  bookingBatteriesCount,
                  remainingActiveStaffCount: 0,
                  totalStaffCount: totalStaffCount,
                  lockedStaffCount: lockedStaffCount,
                  reason: 'Old station requires at least one active staff member when there are active bookings'
                }
              });
            }
            
            // Warning if only 1 staff will remain at old station
            if (remainingStaffCount === 1) {
              const oldStation = await Station.findById(oldStationId);
              console.warn(`⚠️ Warning: Station "${oldStation?.stationName}" will have only ${remainingStaffCount} staff member after transferring "${user.fullName}", with ${bookingBatteriesCount} active booking(s).`);
            }
          }
        }
        
        // If validation passes, assign new station
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
    // find plans by status
    const items = await SubscriptionPlan.find({ status }).lean();

    // if no plans, quick return
    if (!items || !items.length) return res.status(200).json({ success: true, data: [] });

    const planIds = items.map(p => p._id);

    // fetch user subscriptions that reference these plans
    // include subscriptions that are currently active or in-use
    const subs = await UserSubscription.find({ plan: { $in: planIds }, status: { $in: ['active', 'in-use'] } })
      .populate('user', 'fullName email phoneNumber')
      .lean();

    // group subscriptions by plan id
    const subsByPlan = subs.reduce((acc, s) => {
      const key = s.plan ? s.plan.toString() : 'unknown';
      acc[key] = acc[key] || [];
      acc[key].push({
        id: s._id,
        user: s.user ? { id: s.user._id, fullName: s.user.fullName, email: s.user.email, phoneNumber: s.user.phoneNumber } : null,
        start_date: s.start_date,
        end_date: s.end_date,
        remaining_swaps: s.remaining_swaps,
        status: s.status,
      });
      return acc;
    }, {});

    // attach user subscription info and counts to each plan
    const enhanced = items.map(p => {
      const pid = p._id.toString();
      const users = subsByPlan[pid] || [];
      return {
        ...p,
        subscribers: users,
        subscriberCount: users.length,
      };
    });

    return res.status(200).json({ success: true, data: enhanced });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
const baseFields = {
  subscriptionName: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  durations: z.number().int().min(1).optional(),
  description: z.string().optional().optional(),
  status: z.enum(["active", "expired"]).optional(),
};

// discriminated union: different validation for 'change' vs 'periodic'
const upsertPlanSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('change'),
    ...baseFields,
    count_swap: z.number().int().min(0).nullable().optional(),
    quantity_slot: z.number().int().min(1).nullable().optional(),
  }),
  z.object({
    type: z.literal('periodic'),
    ...baseFields,
    // periodic plans: count_swap and quantity_slot are optional and may be 0
    count_swap: z.number().int().min(0).nullable().optional(),
    quantity_slot: z.number().int().min(0).nullable().optional(),
  }),
]);
const upsertPlan = async (req, res) => {
  try {
    const body = upsertPlanSchema.parse(req.body);
    const payload = { ...body };

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

const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if plan exists
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found' });
    }
      // Prevent deletion if drivers are currently using this plan (in-use)
      // or if there are active subscriptions that haven't reached end_date yet.
      const now = new Date();
      const blockingSub = await UserSubscription.findOne({
        plan: id,
        $or: [
          { status: 'in-use' },
          { status: 'active', end_date: { $gt: now } },
        ],
      });
      if (blockingSub) {
        return res.status(400).json({ success: false, message: 'Cannot delete plan while it is within its active duration and in use by drivers' });
      }

      // Delete the plan
      await SubscriptionPlan.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      data: { id },
      message: 'Subscription plan deleted successfully'
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Admin: trigger periodic reservation for a given UserSubscription (dev/admin tool)
const triggerPeriodicReservation = async (req, res) => {
  try {
    const subId = req.params.id || req.body.subscriptionId;
    if (!subId) return res.status(400).json({ success: false, message: 'subscription id is required' });
    const sub = await UserSubscription.findById(subId);
    if (!sub) return res.status(404).json({ success: false, message: 'UserSubscription not found' });

    const service = require('../../services/subscription/periodicReservation.service');
    const result = await service.createReservationForSubscription(sub);
    if (result.ok) {
      return res.status(200).json({ success: true, data: result.details, message: 'Reservation created' });
    }
    return res.status(400).json({ success: false, message: result.reason || 'failed to create reservation', details: result });
  } catch (err) {
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

const updateStationSchema = z.object({
  stationName: z.string().min(2).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  map_url: z.string().url().optional(),
  capacity: z.number().int().min(0).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const updateStation = async (req, res) => {
  try {
    const { id } = req.params;
    const body = updateStationSchema.parse(req.body);
    const station = await Station.findById(id);
    if (!station) return res.status(404).json({ success: false, message: 'Station not found' });

    if (typeof body.stationName !== 'undefined') station.stationName = body.stationName;
    if (typeof body.address !== 'undefined') station.address = body.address;
    if (typeof body.city !== 'undefined') station.city = body.city;
    if (typeof body.district !== 'undefined') station.district = body.district;
    if (typeof body.map_url !== 'undefined') station.map_url = body.map_url;
    if (typeof body.capacity !== 'undefined') station.capacity = body.capacity;

    // If lat/lng both provided, update location
    if (typeof body.lat !== 'undefined' && typeof body.lng !== 'undefined') {
      station.location = { type: 'Point', coordinates: [body.lng, body.lat] };
    } else if (typeof body.lat !== 'undefined' || typeof body.lng !== 'undefined') {
      // If only one coordinate provided, reject to avoid inconsistent state
      return res.status(400).json({ success: false, message: 'Both lat and lng must be provided to update location' });
    }

    await station.save();
    return res.status(200).json({ success: true, data: station, message: 'Station updated' });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    return res.status(400).json({ success: false, message: err.message });
  }
};

const deleteStation = async (req, res) => {
  try {
    const { id } = req.params;
    const station = await Station.findById(id);
    if (!station) return res.status(404).json({ success: false, message: 'Station not found' });

    // Prevent deletion if there are available batteries
    const available = station.availableBatteries ?? (station.batteryCounts ? station.batteryCounts.available : 0);
    if (available && available > 0) {
      return res.status(400).json({ success: false, message: 'Station has available batteries and cannot be deleted' });
    }

    await Station.findByIdAndDelete(id);
    return res.status(200).json({ success: true, data: { id }, message: 'Station deleted' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

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

    // ✅ Validation: Check if staff being transferred is the last staff at old station with active bookings
    const Battery = require('../../models/battery/battery.model');
    
    console.log('🔍 [TRANSFER VALIDATION] Starting validation for', users.length, 'user(s)');
    
    for (const user of users) {
      console.log('🔍 [TRANSFER VALIDATION] Checking user:', {
        id: user._id,
        fullName: user.fullName,
        currentStation: user.station,
        targetStation: id,
        hasStation: !!user.station
      });

      // If staff already has a station (being transferred from old station to new)
      if (user.station && user.station.toString() !== id) {
        const oldStationId = user.station;
        
        console.log('🔍 [TRANSFER VALIDATION] Staff is being transferred from old station:', oldStationId.toString());
        
        // Count batteries with 'is-booking' status at old station
        const bookingBatteriesCount = await Battery.countDocuments({
          station: oldStationId,
          status: 'is-booking'
        });

        console.log('🔍 [TRANSFER VALIDATION] Old station booking batteries count:', bookingBatteriesCount);

        // If old station has batteries with active bookings
        if (bookingBatteriesCount > 0) {
          // Count remaining staff at old station (excluding this staff)
          // ✅ Only count ACTIVE staff (not locked/suspended)
          const remainingStaffCount = await User.countDocuments({
            role: 'staff',
            station: oldStationId,
            _id: { $ne: user._id },
            status: 'active'  // Only count active staff who can handle bookings
          });

          console.log('🔍 [TRANSFER VALIDATION] Remaining staff count at old station:', remainingStaffCount);

          // If no staff will remain at old station, block the transfer
          if (remainingStaffCount === 0) {
            const oldStation = await Station.findById(oldStationId);
            
            // Check if there are locked/inactive staff at the station
            const totalStaffCount = await User.countDocuments({
              role: 'staff',
              station: oldStationId,
              _id: { $ne: user._id }
            });
            const lockedStaffCount = totalStaffCount - remainingStaffCount;
            
            let message = `Cannot transfer staff "${user.fullName}" from station "${oldStation?.stationName}". That station has ${bookingBatteriesCount} battery(ies) with active bookings and this staff member is the only active one assigned.`;
            
            if (lockedStaffCount > 0) {
              message += ` (Note: ${lockedStaffCount} other staff member(s) at this station are locked/inactive and cannot handle bookings)`;
            }
            
            message += ' Please assign another active staff member to that station first or wait for bookings to be completed.';
            
            console.error('❌ [TRANSFER VALIDATION] BLOCKING TRANSFER - No active staff will remain at old station with active bookings');
            console.error(`   Total staff: ${totalStaffCount + 1}, Active staff: 1, Locked staff: ${lockedStaffCount}`);
            
            return res.status(400).json({
              success: false,
              message,
              details: {
                staffName: user.fullName,
                oldStationName: oldStation?.stationName,
                oldStationId: oldStationId,
                bookingBatteriesCount,
                remainingActiveStaffCount: 0,
                totalStaffCount: totalStaffCount,
                lockedStaffCount: lockedStaffCount,
                reason: 'Old station requires at least one active staff member when there are active bookings'
              }
            });
          }

          // Warning if only 1 staff will remain at old station
          if (remainingStaffCount === 1) {
            const oldStation = await Station.findById(oldStationId);
            console.warn(`⚠️ Warning: Station "${oldStation?.stationName}" will have only ${remainingStaffCount} staff member after transferring "${user.fullName}", with ${bookingBatteriesCount} active booking(s).`);
          }
        } else {
          console.log('✅ [TRANSFER VALIDATION] No booking batteries at old station, transfer allowed');
        }
      } else {
        console.log('✅ [TRANSFER VALIDATION] Staff has no old station or same station, transfer allowed');
      }
    }
    
    console.log('✅ [TRANSFER VALIDATION] All validations passed, proceeding with transfer');

    // Assign station to the staff members
    await User.updateMany({ _id: { $in: ids } }, { $set: { station: station._id } });
    const updated = await User.find({ _id: { $in: ids } }).select('-password');
    return res.status(200).json({ success: true, data: updated, message: 'Staff assigned to station' });
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    return res.status(400).json({ success: false, message: err.message });
  }
};

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

    // ✅ Validation: Check if station has active bookings and this is the only staff
    const Battery = require('../../models/battery/battery.model');
    
    // Count batteries with 'is-booking' status at this station
    const bookingBatteriesCount = await Battery.countDocuments({
      station: stationId,
      status: 'is-booking'
    });

    // If there are batteries with active bookings
    if (bookingBatteriesCount > 0) {
      // Count remaining staff at this station (excluding the staff being removed)
      // ✅ Only count ACTIVE staff (not locked/suspended)
      const remainingStaffCount = await User.countDocuments({
        role: 'staff',
        station: stationId,
        _id: { $ne: staffId },
        status: 'active'  // Only count active staff who can handle bookings
      });

      // If no staff will remain, block the removal
      if (remainingStaffCount === 0) {
        // Check if there are locked/inactive staff at the station
        const totalStaffCount = await User.countDocuments({
          role: 'staff',
          station: stationId,
          _id: { $ne: staffId }
        });
        const lockedStaffCount = totalStaffCount - remainingStaffCount;
        
        let message = `Cannot remove staff from station. Station has ${bookingBatteriesCount} battery(ies) with active bookings and this is the only active staff member assigned.`;
        
        if (lockedStaffCount > 0) {
          message += ` (Note: ${lockedStaffCount} other staff member(s) at this station are locked/inactive and cannot handle bookings)`;
        }
        
        message += ' Please assign another active staff member to this station first or wait for bookings to be completed.';
        
        return res.status(400).json({
          success: false,
          message,
          details: {
            stationName: station.stationName,
            bookingBatteriesCount,
            remainingActiveStaffCount: 0,
            totalStaffCount: totalStaffCount,
            lockedStaffCount: lockedStaffCount,
            reason: 'Station requires at least one active staff member when there are active bookings'
          }
        });
      }

      // Warning if only 1 staff will remain
      if (remainingStaffCount === 1) {
        console.warn(`⚠️ Warning: Station "${station.stationName}" will have only ${remainingStaffCount} staff member after removal, with ${bookingBatteriesCount} active booking(s).`);
      }
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

// 🔍 DEBUG ENDPOINT: Check station staff and bookings
const debugStationStaff = async (req, res) => {
  try {
    const { stationId } = req.params;
    const Battery = require('../../models/battery/battery.model');
    
    // Get station
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    
    // Count booking batteries
    const bookingBatteriesCount = await Battery.countDocuments({
      station: stationId,
      status: 'is-booking'
    });
    
    // Get all booking batteries details
    const bookingBatteries = await Battery.find({
      station: stationId,
      status: 'is-booking'
    }).select('serial model status');
    
    // Get all staff at this station
    const staffAtStation = await User.find({
      role: 'staff',
      station: stationId
    }).select('fullName email station role');
    
    // Get total staff count
    const staffCount = await User.countDocuments({
      role: 'staff',
      station: stationId
    });
    
    return res.status(200).json({
      success: true,
      data: {
        station: {
          id: station._id,
          name: station.stationName,
          batteryCounts: station.batteryCounts
        },
        bookings: {
          count: bookingBatteriesCount,
          batteries: bookingBatteries
        },
        staff: {
          count: staffCount,
          list: staffAtStation
        },
        validation: {
          hasBookings: bookingBatteriesCount > 0,
          hasStaff: staffCount > 0,
          canRemoveAllStaff: bookingBatteriesCount === 0 || staffCount > 1,
          warning: bookingBatteriesCount > 0 && staffCount === 1 
            ? 'Cannot remove the only staff member when there are active bookings'
            : null
        }
      }
    });
  } catch (err) {
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
  deletePlan,
  reportsOverview,
  reportsUsage,
  aiPredictions,
  createStation,
  updateStation,
  deleteStation,
  changeUserRole,
  changeUserStatus,
  assignStaffToStation,
  removeStaffFromStation,
  triggerPeriodicReservation,
  debugStationStaff,
};
