const { z, ZodError } = require('zod');
const Booking = require('../../models/booking/booking.model');
const Station = require('../../models/station/station.model');
const Vehicle = require('../../models/vehicle/vehicle.model');
const Battery = require('../../models/battery/battery.model');

const createSchema = z.object({
  station_id: z.string(),
  vehicle_id: z.string(),
  battery_id: z.string(),
  scheduled_time: z.coerce.date(),

});

const createBooking = async (req, res) => {
  try {
    const body = createSchema.parse(req.body);

    // Validate station exists
    const station = await Station.findById(body.station_id);
    if (!station) return res.status(404).json({ success: false, message: 'Station not found' });

    // Validate vehicle exists and belongs to user
    const vehicle = await Vehicle.findOne({ vehicleId: body.vehicle_id, user: req.user.id });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found or does not belong to you' });

    // Validate battery exists and is available at the station
    const battery = await Battery.findOne({
      _id: body.battery_id,
      station: body.station_id,
      status: { $in: ['idle', 'full'] } // Only available batteries
    });

    if (!battery) {
      return res.status(400).json({
        success: false,
        message: 'Battery not found, not at this station, or not available for booking'
      });
    }

    // Check if battery is already booked for the same time
    const existingBooking = await Booking.findOne({
      battery: body.battery_id,
      scheduledTime: {
        $gte: new Date(body.scheduled_time.getTime() - 30 * 60 * 1000), // 30 minutes before
        $lte: new Date(body.scheduled_time.getTime() + 30 * 60 * 1000)  // 30 minutes after
      },
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'This battery is already booked for a similar time slot'
      });
    }

    // Update battery status to 'is-booking'
    await Battery.findByIdAndUpdate(body.battery_id, { status: 'is-booking' });

    const booking = await Booking.create({
      user: req.user.id,
      station: station._id,
      vehicle: body.vehicle_id,
      battery: body.battery_id,
      scheduledTime: body.scheduled_time,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      data: {
        booking_id: booking.bookingId,
        user_id: booking.user.toString(),
        station_id: booking.station.toString(),
        vehicle_id: booking.vehicle.toString(),
        battery_id: booking.battery.toString(),
        scheduled_time: booking.scheduledTime,
        status: booking.status,
      },
      message: 'Booking created successfully',
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: err.errors?.[0]?.message || 'Invalid input' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('battery', 'serial model soh status manufacturer capacity_kWh voltage')
      .populate('station', 'stationName address city district')
      .sort({ createdAt: -1 });

    const data = bookings.map(b => ({
      booking_id: b.bookingId,
      user_id: b.user.toString(),
      station_id: b.station ? b.station._id.toString() : null,
      station_name: b.station ? b.station.stationName : 'Unknown Station',
      station_address: b.station ? b.station.address : 'Unknown Address',
      vehicle_id: b.vehicle.toString(),
      battery_id: b.battery ? b.battery._id.toString() : null,
      battery_info: b.battery ? {
        serial: b.battery.serial,
        model: b.battery.model,
        soh: b.battery.soh,
        status: b.battery.status,
        manufacturer: b.battery.manufacturer,
        capacity_kWh: b.battery.capacity_kWh,
        voltage: b.battery.voltage
      } : null,
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
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (b.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending bookings can be cancelled' });
    b.status = 'cancelled';
    await b.save();

    if (b.battery) {
      await Battery.findByIdAndUpdate(b.battery, { status: 'idle' });
    }

    return res.status(200).json({ success: true, data: null, message: 'Booking cancelled' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getBookingDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await Booking.findOne({ bookingId: id, user: req.user.id })
      .populate('battery', 'serial model soh status manufacturer capacity_kWh voltage')
      .populate('station', 'stationName address city district');

    if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });

    return res.status(200).json({
      success: true,
      data: {
        booking_id: b.bookingId,
        user_id: b.user.toString(),
        station_id: b.station ? b.station._id.toString() : null,
        station_name: b.station ? b.station.stationName : 'Unknown Station',
        station_address: b.station ? b.station.address : 'Unknown Address',
        vehicle_id: b.vehicle.toString(),
        battery_id: b.battery ? b.battery._id.toString() : null,
        battery_info: b.battery ? {
          serial: b.battery.serial,
          model: b.battery.model,
          soh: b.battery.soh,
          status: b.battery.status,
          manufacturer: b.battery.manufacturer,
          capacity_kWh: b.battery.capacity_kWh,
          voltage: b.battery.voltage
        } : null,
        scheduled_time: b.scheduledTime,
        status: b.status,
        created_at: b.createdAt,
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// Driver completes a booking. Only the booking owner (driver) can mark as completed.
const completeBooking = async (req, res) => {
  try {
    const { id } = req.params; // bookingId
    const b = await Booking.findOne({ bookingId: id, user: req.user.id, status: 'confirmed' });
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found or not in confirmed state' });

    b.status = 'completed';
    await b.save();

    if (b.battery) {
      // mark battery as idle (driver returned battery)
      await Battery.findByIdAndUpdate(b.battery, { status: 'idle' });
      // Record battery history
      const BatteryHistory = require('../../models/battery/batteryHistory.model');
      await BatteryHistory.create({ battery: b.battery, station: b.station, action: 'return', details: `Completed by driver ${req.user.id}` });
    }

    return res.status(200).json({ success: true, data: null, message: 'Booking completed' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createBooking, listBookings, cancelBooking, getBookingDetail, completeBooking };
