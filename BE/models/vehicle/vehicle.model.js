const mongoose = require("mongoose");
const crypto = require("crypto");

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: String,
      unique: true,
      default: () => crypto.randomUUID(),
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vin: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-HJ-NPR-Z0-9]{17}$/, "VIN must be 17 characters (no I,O,Q)"],
    },
    // Reference to current battery assigned to vehicle (if any)
    battery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Battery',
      default: null,
      index: true
    },
    licensePlate: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 4,
      maxlength: 15,
    },
    carName: { type: String, trim: true },
    brand: { type: String, trim: true },
    modelYear: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear() + 1,
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ user: 1 });
vehicleSchema.index({ vin: 1 }, { unique: true });
vehicleSchema.index({ licensePlate: 1 }, { unique: true });

module.exports = mongoose.model("Vehicle", vehicleSchema);
