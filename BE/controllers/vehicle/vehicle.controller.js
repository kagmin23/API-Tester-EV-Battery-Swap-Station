const { z, ZodError } = require("zod");
const Vehicle = require("../../models/vehicle/vehicle.model");
const Battery = require("../../models/battery/battery.model");

const vehicleCreateSchema = z.object({
  vin: z
    .string()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, {
      message: "VIN must be 17 characters (no I,O,Q)",
    }),
  battery: z
    .object({
      serial: z.string().trim(),
      model: z.string().trim().optional(),
      soh: z.number().min(0).max(100).optional(),
      manufacturer: z.string().trim().optional(),
      station: z.string().trim().optional(),
      capacity_kWh: z.number().min(0).optional(),
      price: z.number().min(0).optional(),
      voltage: z.number().min(0).optional(),
      status: z
        .enum(["charging", "full", "faulty", "in-use", "idle", "is-booking"]) // matches battery.model
        .optional(),
    })
    .optional()
    .nullable(),
  license_plate: z.string().min(4).max(15),
  car_name: z.string().trim().optional().default(""),
  brand: z.string().trim().optional().default(""),
  model_year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
});

const formatVehicle = (v) => ({
  vehicle_id: v.vehicleId,
  user_id: v.user.toString(),
  vin: v.vin,
  battery_id: v.battery ? v.battery.toString() : null,
  license_plate: v.licensePlate,
  car_name: v.carName || "",
  brand: v.brand || "",
  model_year: v.modelYear || null,
  created_at: v.createdAt,
  updated_at: v.updatedAt,
});

const createVehicle = async (req, res) => {
  try {
    // Log raw incoming body for debugging mismatches
    console.log('createVehicle raw body:', req.body);
    const body = vehicleCreateSchema.parse(req.body);
    console.log('createVehicle parsed body:', body);
    const userId = req.user.id;

    const existsVin = await Vehicle.findOne({ vin: body.vin.toUpperCase() });
    if (existsVin)
      return res.status(409).json({ success: false, message: "VIN already registered" });

    const existsPlate = await Vehicle.findOne({ licensePlate: body.license_plate.toUpperCase() });
    if (existsPlate)
      return res.status(409).json({ success: false, message: "License plate already registered" });

    // If client provided a battery object, create the Battery document and attach its id.
    let batteryToAttach = null;
    if (body.battery) {
      try {
        const created = await Battery.create({
          ...body.battery,
          soh: body.battery.soh !== undefined ? body.battery.soh : 100,
          status: body.battery.status !== undefined ? body.battery.status : 'in-use',
        });
        batteryToAttach = created._id;
      } catch (err) {
        // If serial already exists (unique index), find and attach existing battery instead of failing.
        if (err && err.code === 11000 && body.battery && body.battery.serial) {
          const existing = await Battery.findOne({ serial: body.battery.serial });
          if (existing) batteryToAttach = existing._id;
          else throw err;
        } else {
          throw err;
        }
      }
    }

    const vehicle = await Vehicle.create({
      user: userId,
      vin: body.vin.toUpperCase(),
      battery: batteryToAttach || null,
      licensePlate: body.license_plate.toUpperCase(),
      carName: body.car_name,
      brand: body.brand,
      modelYear: body.model_year,
    });

    return res.status(201).json({ success: true, data: formatVehicle(vehicle), message: "Vehicle linked successfully" });
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors?.[0];
      console.log('createVehicle validation errors:', err.errors);
      return res.status(400).json({ success: false, data: { issues: err.errors }, message: first?.message || "Invalid input" });
    }
    console.error('createVehicle error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listVehicles = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const queryAll = req.query.all === 'true';

    if (queryAll && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let filter = { user: req.user.id };
    if (isAdmin && queryAll) filter = {};
    const vehicles = await Vehicle.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: vehicles.map(formatVehicle) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getVehicle = async (req, res) => {
  try {
    const { id } = req.params; // route uses /:id
    console.log('getVehicle params:', req.params);

    // Basic validation: reject placeholder values like '{vehicleId}'
    if (!id || id.includes('{') || id.includes('}')) {
      return res.status(400).json({ success: false, message: 'Invalid vehicle id provided' });
    }

    // We store a `vehicleId` field on the document (not _id), so query by that
    const v = await Vehicle.findOne({ vehicleId: id });
    if (!v) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.role !== 'driver' && v.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return res.status(200).json({ success: true, data: formatVehicle(v) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const vehicleUpdateSchema = z.object({
  battery: z
    .object({
      serial: z.string().trim(),
      model: z.string().trim().optional(),
      soh: z.number().min(0).max(100).optional(),
      manufacturer: z.string().trim().optional(),
      capacity_kWh: z.number().min(0).optional(),
      price: z.number().min(0).optional(),
      voltage: z.number().min(0).optional(),
      status: z
        .enum(["charging", "full", "faulty", "in-use", "idle", "is-booking"]) // matches battery.model
        .optional(),
    })
    .optional()
    .nullable(),
  license_plate: z.string().min(4).max(15).optional(),
  car_name: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  model_year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
});

const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const body = vehicleUpdateSchema.parse(req.body);
    const v = await Vehicle.findOne({ vehicleId: id });
    if (!v) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (req.user.role !== 'admin' && v.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (body.license_plate) {
      const existsPlate = await Vehicle.findOne({ licensePlate: body.license_plate.toUpperCase(), _id: { $ne: v._id } });
      if (existsPlate) return res.status(409).json({ success: false, message: 'License plate already registered' });
      v.licensePlate = body.license_plate.toUpperCase();
    }
    if (body.car_name !== undefined) v.carName = body.car_name;
    if (body.brand !== undefined) v.brand = body.brand;
    if (body.model_year !== undefined) v.modelYear = body.model_year;
    // Note: `battery_id` is no longer accepted. Provide `battery` object to create/attach.

    // If a battery object is provided, create it and attach
    if (body.battery) {
      let batteryToAttach = null;
      try {
        const created = await Battery.create({
          ...body.battery,
          soh: body.battery.soh !== undefined ? body.battery.soh : 100,
          status: body.battery.status !== undefined ? body.battery.status : 'in-use',
        });
        batteryToAttach = created._id;
      } catch (err) {
        if (err && err.code === 11000 && body.battery && body.battery.serial) {
          const existing = await Battery.findOne({ serial: body.battery.serial });
          if (existing) batteryToAttach = existing._id;
          else throw err;
        } else {
          throw err;
        }
      }
      v.battery = batteryToAttach;
    }

    await v.save();
    return res.status(200).json({ success: true, data: formatVehicle(v), message: 'Vehicle updated' });
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors?.[0];
      return res.status(400).json({ success: false, data: { issues: err.errors }, message: first?.message || "Invalid input" });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const v = await Vehicle.findOne({ vehicleId: id });
    if (!v) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (req.user.role !== 'admin' && v.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await v.deleteOne();
    return res.status(200).json({ success: true, data: null, message: 'Vehicle deleted' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
};
