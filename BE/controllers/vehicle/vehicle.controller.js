const { z, ZodError } = require("zod");
const Vehicle = require("../../models/vehicle/vehicle.model");

const vehicleCreateSchema = z.object({
  vin: z
    .string()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, {
      message: "VIN must be 17 characters (no I,O,Q)",
    }),
  battery_model: z.string().trim().optional().default(""),
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
  battery_model: v.batteryModel || "",
  license_plate: v.licensePlate,
  car_name: v.carName || "",
  brand: v.brand || "",
  model_year: v.modelYear || null,
  created_at: v.createdAt,
  updated_at: v.updatedAt,
});

const createVehicle = async (req, res) => {
  try {
    const body = vehicleCreateSchema.parse(req.body);
    const userId = req.user.id;

    const existsVin = await Vehicle.findOne({ vin: body.vin.toUpperCase() });
    if (existsVin)
      return res.status(409).json({ success: false, message: "VIN already registered" });

    const existsPlate = await Vehicle.findOne({ licensePlate: body.license_plate.toUpperCase() });
    if (existsPlate)
      return res.status(409).json({ success: false, message: "License plate already registered" });

    const vehicle = await Vehicle.create({
      user: userId,
      vin: body.vin.toUpperCase(),
      batteryModel: body.battery_model,
      licensePlate: body.license_plate.toUpperCase(),
      carName: body.car_name,
      brand: body.brand,
      modelYear: body.model_year,
    });

    return res.status(201).json({ success: true, data: formatVehicle(vehicle), message: "Vehicle linked successfully" });
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors?.[0];
      return res.status(400).json({ success: false, data: { issues: err.errors }, message: first?.message || "Invalid input" });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listVehicles = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const queryAll = req.query.all === 'true';
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
    const { id } = req.params;
    const v = await Vehicle.findOne({ vehicleId: id });
    if (!v) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && v.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return res.status(200).json({ success: true, data: formatVehicle(v) });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const vehicleUpdateSchema = z.object({
  battery_model: z.string().trim().optional(),
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
    if (body.battery_model !== undefined) v.batteryModel = body.battery_model;
    if (body.car_name !== undefined) v.carName = body.car_name;
    if (body.brand !== undefined) v.brand = body.brand;
    if (body.model_year !== undefined) v.modelYear = body.model_year;

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
