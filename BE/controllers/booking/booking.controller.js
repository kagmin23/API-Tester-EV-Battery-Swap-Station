const { z, ZodError } = require("zod");
const Booking = require("../../models/booking/booking.model");
const Station = require("../../models/station/station.model");
const Vehicle = require("../../models/vehicle/vehicle.model");
const Battery = require("../../models/battery/battery.model");
const BatteryPillar = require("../../models/battery/batteryPillar.model");
const BatterySlot = require("../../models/battery/batterySlot.model");
const BatteryHistory = require("../../models/battery/batteryHistory.model");
const User = require('../../models/auth/auth.model');

const createSchema = z.object({
  station_id: z.string(),
  pillar_id: z.string(),
  vehicle_id: z.string(),
  battery_id: z.string(),
  scheduled_time: z.coerce.date(),

});

const createBooking = async (req, res) => {
  try {
    const body = createSchema.parse(req.body);

    // Validate station exists
    const station = await Station.findById(body.station_id);
    if (!station)
      return res
        .status(404)
        .json({ success: false, message: "Station not found" });

    // Validate vehicle exists and belongs to user
    const vehicle = await Vehicle.findOne({
      vehicleId: body.vehicle_id,
      user: req.user.id,
    });
    if (!vehicle)
      return res
        .status(404)
        .json({
          success: false,
          message: "Vehicle not found or does not belong to you",
        });

    // Validate battery exists and is available at the station
    // ✅ Check Battery Status (sức khỏe pin)
    // Debug logs: print request and user ids to help diagnose "not found" cases
    try {
      console.log('🔎 Booking debug - req.user.id:', req.user && req.user.id);
      console.log('🔎 Booking debug - request body:', JSON.stringify(body));
    } catch (e) {
      // ignore logging errors
    }

    // Fetch battery by id and manually validate station/status so we can
    // allow the case where status === 'is-booking' but the slot is reserved
    // for the same user (frontend may pre-reserve).
    const battery = await Battery.findById(body.battery_id).populate('currentSlot');

    try {
      const batteryObj = battery ? battery.toObject() : null;
      console.log('🔎 Booking debug - Battery.findById (initial) result:', JSON.stringify(batteryObj, null, 2));
    } catch (e) {
      console.log('🔎 Booking debug - Battery.findById (initial) result: [unable to stringify]');
    }

    if (!battery) {
      // Additional debug: fetch by ID only to inspect actual stored doc
      return res.status(400).json({
        success: false,
        message: "Battery not found",
      });
    }

    // Validate station matches
    if (!battery.station || battery.station.toString() !== body.station_id) {
      return res.status(400).json({ success: false, message: 'Battery is not at this station' });
    }

    // Check allowed status:
    // - allow if battery.status is 'idle' or 'full'
    // - OR allow if battery.status === 'is-booking' AND the slot reservation (if any)
    //   belongs to the same user (frontend may have reserved the slot)
    const allowedStatuses = ['idle', 'full'];
    let allowedByStatus = allowedStatuses.includes(battery.status);

    if (!allowedByStatus && battery.status === 'is-booking') {
      // show debug about slot reservation (if any)
      try {
        console.log('🔎 Booking debug - currentSlot reservation:', JSON.stringify(battery.currentSlot && battery.currentSlot.reservation));
      } catch (e) {
        console.log('🔎 Booking debug - currentSlot reservation: [unable to stringify]');
      }

      // allow if slot is occupied and either there is no reservation
      // or reservation belongs to same user
      const slotStatus = battery.currentSlot && battery.currentSlot.status;
      const slotRes = battery.currentSlot && battery.currentSlot.reservation;

      if (slotStatus === 'occupied' && (!slotRes || !slotRes.user || (req.user && req.user.id && slotRes.user.toString() === req.user.id.toString()))) {
        allowedByStatus = true;
        console.log('🔎 Booking debug - allowing booking for is-booking battery because slot is occupied and not reserved by another user');
      }
    }

    if (!allowedByStatus) {
      return res.status(400).json({
        success: false,
        message: "Battery not found, not at this station, or not available for booking",
      });
    }

    // ✅ Validate pin phải đang nằm trong slot (không đang được sử dụng trên xe)
    if (!battery.currentSlot) {
      return res.status(400).json({
        success: false,
        message: "Battery is not in any slot. It may be in use or unavailable for booking.",
      });
    }

    // ✅ Validate Slot Status phải là 'occupied' (slot đang có pin)
    if (battery.currentSlot.status !== 'occupied') {
      return res.status(400).json({
        success: false,
        message: `Battery's slot is ${battery.currentSlot.status}. Can only book batteries in occupied slots.`,
      });
    }

    // Validate pillar if provided
    let pillar = null;
    if (body.pillar_id) {
      pillar = await BatteryPillar.findOne({
        _id: body.pillar_id,
        station: body.station_id,
      });

      if (!pillar) {
        return res.status(400).json({
          success: false,
          message: "Pillar not found or does not belong to this station",
        });
      }

      // Optionally: Verify the battery is actually in this pillar
      if (battery.currentPillar && battery.currentPillar.toString() !== body.pillar_id) {
        return res.status(400).json({
          success: false,
          message: "Battery is not located in the specified pillar",
        });
      }

      // ✅ Check if pillar has at least 1 empty slot for old battery insertion
      await pillar.updateSlotStats(); // Update stats first
      if (pillar.slotStats.empty < 1) {
        return res.status(400).json({
          success: false,
          message: `No empty slot available in ${pillar.pillarName}. Cannot accept old battery. Please choose another pillar or contact staff.`,
        });
      }
    }

    // Check if battery is already booked for the same time
    const existingBooking = await Booking.findOne({
      battery: body.battery_id,
      scheduledTime: {
        $gte: new Date(body.scheduled_time.getTime() - 30 * 60 * 1000), // 30 minutes before
        $lte: new Date(body.scheduled_time.getTime() + 30 * 60 * 1000), // 30 minutes after
      },
      status: { $in: ["booked", "ready"] }, // ✅ Bỏ pending, chỉ check confirmed và ready
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "This battery is already booked for a similar time slot",
      });
    }

    // ✅ Kiểm tra user có subscription không
    // Nếu có subscription active/in-use với remaining_swaps > 0 hoặc unlimited (null), 
    // sẽ attach subscription vào booking và decrement remaining_swaps
    let attachedSubscription = null;
    try {
      const UserSubscription = require('../../models/subscription/userSubscription.model');
      const activeSub = await UserSubscription.findOne({
        user: req.user.id,
        status: { $in: ['active', 'in-use'] }, // ✅ Accept both active and in-use
        $or: [
          { remaining_swaps: { $gt: 0 } },
          { remaining_swaps: null }
        ]
      });

      if (activeSub) {
        // Decrement remaining_swaps atomically nếu không phải unlimited
        if (activeSub.remaining_swaps !== null && activeSub.remaining_swaps !== undefined) {
          const updated = await UserSubscription.findOneAndUpdate(
            { _id: activeSub._id, remaining_swaps: { $gt: 0 } },
            {
              $inc: { remaining_swaps: -1 },
              $set: { status: 'in-use' } // ✅ Change status to in-use when first used
            },
            { new: true }
          );
          if (!updated) {
            // Swap cuối cùng đã bị tiêu thụ bởi request khác
            attachedSubscription = null;
          } else {
            attachedSubscription = updated;
          }
        } else {
          // Unlimited swaps - also set to in-use
          const updated = await UserSubscription.findByIdAndUpdate(
            activeSub._id,
            { status: 'in-use' },
            { new: true }
          );
          attachedSubscription = updated;
        }
      }
    } catch (errSubAttach) {
      console.error('Error attaching subscription to booking:', errSubAttach);
      attachedSubscription = null;
    }

    // ✅ Update Battery Status to 'is-booking' (Battery Status)
    await Battery.findByIdAndUpdate(body.battery_id, { status: "is-booking" });

    // ✅ Update Slot Status to 'reserved' (Slot Status)
    if (battery.currentSlot) {
      await BatterySlot.findByIdAndUpdate(battery.currentSlot._id, {
        status: 'reserved',
        reservation: {
          booking: null, // Will be updated after booking created
          user: req.user.id,
          reservedAt: new Date(),
          expiresAt: new Date(body.scheduled_time.getTime() + 30 * 60 * 1000) // 30 minutes after scheduled time
        }
      });
    }

    const bookingPayload = {
      user: req.user.id,
      station: station._id,
      vehicle: body.vehicle_id,
      battery: body.battery_id,
      scheduledTime: body.scheduled_time,
      status: 'booked',
    };
    if (attachedSubscription) bookingPayload.subscription = attachedSubscription._id; // ✅ Attach subscription nếu có
    if (body.pillar_id) bookingPayload.pillar = body.pillar_id;

    const booking = await Booking.create(bookingPayload);

    // ✅ Update slot reservation with booking ID
    if (battery.currentSlot) {
      await BatterySlot.findByIdAndUpdate(battery.currentSlot._id, {
        'reservation.booking': booking._id
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        booking_id: booking.bookingId,
        user_id: booking.user.toString(),
        station_id: booking.station.toString(),
        pillar_id: booking.pillar ? booking.pillar.toString() : null,
        vehicle_id: booking.vehicle.toString(),
        battery_id: booking.battery.toString(),
        scheduled_time: booking.scheduledTime,
        status: booking.status,
      },
      message: "Booking created successfully",
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({
          success: false,
          message: err.errors?.[0]?.message || "Invalid input",
        });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate(
        "battery",
        "serial model soh status manufacturer capacity_kWh voltage"
      )
      .populate("station", "stationName address city district")
      .sort({ createdAt: -1 });

    const data = bookings.map((b) => ({
      id: b._id,
      booking_id: b.bookingId,
      user_id: b.user.toString(),
      station_id: b.station ? b.station._id.toString() : null,
      pillar_id: b.pillar ? b.pillar._id.toString() : null,
      station_name: b.station ? b.station.stationName : "Unknown Station",
      station_address: b.station ? b.station.address : "Unknown Address",
      vehicle_id: b.vehicle.toString(),
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

const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await Booking.findOne({ bookingId: id, user: req.user.id });
    if (!b)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    if (!["booked", "ready"].includes(b.status)) {
      return res.status(400).json({
        success: false,
        message: "Only booked or ready bookings can be cancelled", // ✅ Bỏ pending
      });
    }

    b.status = "cancelled";
    await b.save();

    // ✅ Restore Battery Status và Slot Status khi cancel
    if (b.battery) {
      const battery = await Battery.findById(b.battery).populate('currentSlot');

      // Restore Battery Status về 'idle' hoặc 'full'
      if (battery) {
        await Battery.findByIdAndUpdate(b.battery, {
          status: battery.soh >= 80 ? "full" : "idle"
        });

        // ✅ Restore Slot Status về 'occupied'
        if (battery.currentSlot) {
          await BatterySlot.findByIdAndUpdate(battery.currentSlot._id, {
            status: 'occupied',
            reservation: undefined // Clear reservation
          });
        }
      }
    }

    return res
      .status(200)
      .json({
        success: true,
        data: null,
        message: "Booking cancelled successfully",
      });
  } catch (err) {
    return res
      .status(400)
      .json({
        success: false,
        message: err.message || "Failed to cancel booking",
      });
  }
};

const getBookingDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await Booking.findOne({ bookingId: id, user: req.user.id })
      .populate(
        "battery",
        "serial model soh status manufacturer capacity_kWh voltage"
      )
      .populate("station", "stationName address city district");

    if (!b)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    return res.status(200).json({
      success: true,
      data: {
        booking_id: b.bookingId,
        user_id: b.user.toString(),
        station_id: b.station ? b.station._id.toString() : null,
        station_name: b.station ? b.station.stationName : "Unknown Station",
        station_address: b.station ? b.station.address : "Unknown Address",
        vehicle_id: b.vehicle.toString(),
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
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const arrivedBooking = async (req, res) => {
  try {
    const { id } = req.params; // bookingId

    const b = await Booking.findOne({
      bookingId: id,
      user: req.user.id,
      status: "booked",
    });

    if (!b) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or not in booked state",
      });
    }

    // ✅ Chỉ đổi trạng thái booking thôi
    b.status = "arrived";
    await b.save();

    // ✅ KHÔNG xử lý Battery Status và Slot Status ở đây
    // Việc đó sẽ do batterySwap.controller xử lý khi:
    // - initiateSwap(): Tìm pin đã booking và slot trống
    // - insertOldBattery(): Bỏ pin cũ vào, lấy pin mới ra
    // - completeSwap(): Hoàn tất giao dịch, update tất cả status

    return res.status(200).json({
      success: true,
      message: "Booking marked as arrived. Please proceed to battery swap.",
      data: {
        booking_id: b.bookingId,
        status: b.status,
        next_step: "Use /api/battery-swap/swap/initiate to start the swap process"
      }
    });
  } catch (err) {
    console.error("Error marking booking as arrived:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  createBooking,
  listBookings,
  cancelBooking,
  getBookingDetail,
  arrivedBooking,
};
