const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^0\d{9}$/, "Phone number must be 10 digits and start with 0"],
    },
    // Role-based access control
    role: {
      type: String,
      enum: ["admin", "driver", "staff"],
      default: "driver", // Assumption: users registering are drivers by default
      required: true,
      index: true,
    },
    refreshToken: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    emailOTP: { type: String, default: null },
    emailOTPExpires: { type: Date, default: null },
    emailOTPLastSentAt: { type: Date, default: null },
    emailOTPResendCount: { type: Number, default: 0 },
    emailOTPResendWindowStart: { type: Date, default: null },
    passwordResetOTP: { type: String, default: null },
    passwordResetOTPExpires: { type: Date, default: null },
    passwordResetOTPLastSentAt: { type: Date, default: null },
    passwordResetOTPResendCount: { type: Number, default: 0 },
    passwordResetOTPResendWindowStart: { type: Date, default: null },
    // Account status control
    status: {
      type: String,
      enum: ["active", "locked"],
      default: "active",
      index: true,
    },
    // Public avatar URL (served from /public or external)
    avatar: { type: String, default: null },
    // Staff assigned station
    station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', index: true, default: null },
  },
  { timestamps: true }
);

// Hash password trước khi lưu
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// So sánh password
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
