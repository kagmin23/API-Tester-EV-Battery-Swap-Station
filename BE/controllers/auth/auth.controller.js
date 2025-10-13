const User = require("../../models/auth/auth.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { z, ZodError } = require("zod");
const { sendEmail } = require("../../utils/mailer");
require("dotenv").config();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Config thời gian sống token
const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m"; // ví dụ: 15p
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(
  process.env.JWT_REFRESH_EXPIRES_DAYS || "7",
  10
); // 7 ngày

const signAccessToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
};

const generateRefreshTokenValue = () => crypto.randomBytes(48).toString("hex");

const login = async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await User.findOne({ email: data.email });
    if (!user)
      return res.status(400).json({
        success: false,
        data: null,
        message: "Incorrect account or password",
      });

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        data: {
          requireEmailVerification: true,
          nextActions: {
            verifyEndpoint: "/api/auth/verify-email",
            resendOtpEndpoint: "/api/auth/resend-otp",
          },
        },
        message:
          "Account not verified. Please enter the OTP code sent to your email to activate before logging in.",
      });
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch)
      return res.status(400).json({
        success: false,
        data: null,
        message: "Incorrect account or password",
      });

    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshTokenValue();
    const refreshExpires = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );
    user.refreshToken = refreshToken;
    user.refreshTokenExpiresAt = refreshExpires;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRES,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
            role: user.role,
        },
      },
      message: "Login successfully",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
};

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
    fullName: z.string().min(2).max(100),
    phoneNumber: z
      .string()
      .regex(/^0\d{9}$/, { message: "Phone number must be 10 digits" }),
    // Optional role assignment: only honored if requester is admin
    role: z.enum(["admin", "driver", "staff"]).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const register = async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const exists = await User.findOne({ email: data.email });
    if (exists)
      return res.status(409).json({
        success: false,
        data: null,
        message: "Email already in use",
      });

    // Tạo OTP 6 chữ số và hash
    const OTP_EXPIRES_MINUTES = parseInt(
      process.env.OTP_EXPIRES_MINUTES || "10",
      10
    );
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");
    const otpExpires = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    // Determine role: if requester is authenticated admin, allow explicit role; else default handled by model
    let roleToSet = undefined;
    if (req.user && req.user.role === "admin" && req.body.role) {
      roleToSet = req.body.role;
    }

    const user = new User({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      ...(roleToSet ? { role: roleToSet } : {}),
      isVerified: false,
      emailOTP: otpHash,
      emailOTPExpires: otpExpires,
      emailOTPLastSentAt: new Date(),
      emailOTPResendCount: 0,
      emailOTPResendWindowStart: new Date(),
    });
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Your verification code",
        text: `Your verification code is ${rawOtp}. It will expire in ${OTP_EXPIRES_MINUTES} minutes.`,
      });
    } catch (mailErr) {
      console.error("Failed to send OTP email:", mailErr.message);
    }

    res.status(201).json({
      success: true,
      data: { email: user.email },
      message:
        "Registered successfully. Please verify your email with the OTP sent.",
    });
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors?.[0];
      return res.status(400).json({
        success: false,
        data: { issues: err.errors },
        message: first?.message || "Invalid input",
      });
    }
    res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({
        success: false,
        data: null,
        message: "RefreshToken is required",
      });

    const user = await User.findOne({ refreshToken });
    if (!user)
      return res.status(401).json({
        success: false,
        data: null,
        message: "Invalid refresh token",
      });

    if (
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt < new Date()
    ) {
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
      return res.status(401).json({
        success: false,
        data: null,
        message: "Refresh token expired. Please login again.",
      });
    }

    const newRefreshToken = generateRefreshTokenValue();
    const newRefreshExpires = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );
    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiresAt = newRefreshExpires;
    const accessToken = signAccessToken(user);
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRES,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      },
      message: "Token refreshed successfully",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({
        success: false,
        data: null,
        message: "RefreshToken is required",
      });
    const user = await User.findOne({ refreshToken });
    if (user) {
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
    }
    res.status(200).json({
      success: true,
      data: null,
      message: "Logged out successfully",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({
        success: false,
        data: null,
        message: "Email and OTP are required",
      });
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({
        success: false,
        data: null,
        message: "User not found",
      });
    if (user.isVerified)
      return res.status(200).json({
        success: true,
        data: null,
        message: "Already verified",
      });
    if (!user.emailOTP || !user.emailOTPExpires)
      return res.status(400).json({
        success: false,
        data: null,
        message: "No OTP pending",
      });
    if (user.emailOTPExpires < new Date())
      return res.status(400).json({
        success: false,
        data: null,
        message: "OTP expired",
      });
    const providedHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (user.emailOTP !== providedHash)
      return res.status(400).json({
        success: false,
        data: null,
        message: "Invalid OTP",
      });
    user.isVerified = true;
    user.emailOTP = null;
    user.emailOTPExpires = null;
    user.emailOTPLastSentAt = null;
    user.emailOTPResendCount = 0;
    user.emailOTPResendWindowStart = null;
    await user.save();
    res.status(200).json({
      success: true,
      data: { email: user.email },
      message: "Email verified. You can now login.",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({
        success: false,
        data: null,
        message: "Email is required",
      });
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({
        success: false,
        data: null,
        message: "User not found",
      });
    if (user.isVerified)
      return res.status(200).json({
        success: true,
        data: null,
        message: "Already verified",
      });
    const minIntervalMs = parseInt(
      process.env.OTP_RESEND_MIN_INTERVAL_MS || "60000",
      10
    ); // default 60s
    const windowHours = parseInt(
      process.env.OTP_RESEND_WINDOW_HOURS || "24",
      10
    ); // default 24h window
    const windowMax = parseInt(process.env.OTP_RESEND_WINDOW_MAX || "5", 10); // default 5 resend / window

    const now = new Date();
    // Reset window if needed
    if (
      !user.emailOTPResendWindowStart ||
      now - user.emailOTPResendWindowStart > windowHours * 60 * 60 * 1000
    ) {
      user.emailOTPResendWindowStart = now;
      user.emailOTPResendCount = 0;
    }

    // Check count
    if (user.emailOTPResendCount >= windowMax) {
      return res.status(429).json({
        success: false,
        data: null,
        message: "Resend OTP limit reached. Please try later.",
      });
    }

    // Check interval
    if (
      user.emailOTPLastSentAt &&
      now - user.emailOTPLastSentAt < minIntervalMs
    ) {
      const waitMs = minIntervalMs - (now - user.emailOTPLastSentAt);
      return res.status(429).json({
        success: false,
        data: { waitSeconds: Math.ceil(waitMs / 1000) },
        message: `Please wait ${Math.ceil(
          waitMs / 1000
        )}s before requesting another OTP.`,
      });
    }

    const OTP_EXPIRES_MINUTES = parseInt(
      process.env.OTP_EXPIRES_MINUTES || "10",
      10
    );
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");
    user.emailOTP = otpHash;
    user.emailOTPExpires = new Date(
      Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000
    );
    user.emailOTPLastSentAt = now;
    user.emailOTPResendCount += 1;
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Your verification code (resend)",
        text: `Your verification code is ${rawOtp}. It will expire in ${OTP_EXPIRES_MINUTES} minutes.`,
      });
    } catch (mailErr) {
      console.error("Failed to resend OTP email:", mailErr.message);
    }

    res.status(200).json({
      success: true,
      data: { email: user.email },
      message: "OTP resent. Please check your email.",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
};

// Forgot password - send reset OTP
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({
        success: false,
        data: null,
        message: "email is required",
      });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({
        success: false,
        data: null,
        message: "User not found",
      });

    const minIntervalMs = parseInt(
      process.env.PASSWORD_RESET_MIN_INTERVAL_MS || "60000",
      10
    ); // 60s
    const windowHours = parseInt(
      process.env.PASSWORD_RESET_WINDOW_HOURS || "24",
      10
    ); // 24h
    const windowMax = parseInt(
      process.env.PASSWORD_RESET_WINDOW_MAX || "3",
      10
    ); // 3 times/24h

    const now = new Date();
    // Reset window if needed
    if (
      !user.passwordResetOTPResendWindowStart ||
      now - user.passwordResetOTPResendWindowStart >
        windowHours * 60 * 60 * 1000
    ) {
      user.passwordResetOTPResendWindowStart = now;
      user.passwordResetOTPResendCount = 0;
    }

    // Check count limit
    if (user.passwordResetOTPResendCount >= windowMax) {
      return res.status(429).json({
        success: false,
        data: null,
        message: "Password reset limit reached. Please try later.",
      });
    }

    // Check interval
    if (
      user.passwordResetOTPLastSentAt &&
      now - user.passwordResetOTPLastSentAt < minIntervalMs
    ) {
      const waitMs = minIntervalMs - (now - user.passwordResetOTPLastSentAt);
      return res.status(429).json({
        success: false,
        data: { waitSeconds: Math.ceil(waitMs / 1000) },
        message: `Please wait ${Math.ceil(
          waitMs / 1000
        )}s before requesting another reset.`,
      });
    }

    const OTP_EXPIRES_MINUTES = parseInt(
      process.env.PASSWORD_RESET_OTP_EXPIRES_MINUTES || "15",
      10
    );
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");

    user.passwordResetOTP = otpHash;
    user.passwordResetOTPExpires = new Date(
      Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000
    );
    user.passwordResetOTPLastSentAt = now;
    user.passwordResetOTPResendCount += 1;
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Code",
        text: `Your password reset code is ${rawOtp}. It will expire in ${OTP_EXPIRES_MINUTES} minutes.`,
      });
    } catch (mailErr) {
      console.error("Failed to send password reset email:", mailErr.message);
    }

    res.status(200).json({
      success: true,
      data: { email: user.email },
      message: "Password reset code sent to your email.",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "email, otp, and newPassword are required" 
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "New password must be at least 6 characters" 
      });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ 
      success: false, 
      data: null, 
      message: "User not found" 
    });

    if (!user.passwordResetOTP || !user.passwordResetOTPExpires) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "No password reset request pending" 
      });
    }

    if (user.passwordResetOTPExpires < new Date()) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "Password reset code expired" 
      });
    }

    const providedHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (user.passwordResetOTP !== providedHash) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "Invalid reset code" 
      });
    }

    // Reset password and clear reset fields
    user.password = newPassword; // Will be hashed by pre-save middleware
    user.passwordResetOTP = null;
    user.passwordResetOTPExpires = null;
    user.passwordResetOTPLastSentAt = null;
    user.passwordResetOTPResendCount = 0;
    user.passwordResetOTPResendWindowStart = null;

    // Also invalidate refresh tokens for security
    user.refreshToken = null;
    user.refreshTokenExpiresAt = null;

    await user.save();

    res.status(200).json({
      success: true,
      data: { email: user.email },
      message: "Password reset successfully. Please login with your new password.",
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      data: null, 
      message: err.message 
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "oldPassword, newPassword, and confirmNewPassword are required",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "New passwords do not match" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "New password must be at least 6 characters" 
      });
    }

    // Get user from token (set by auth middleware)
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ 
      success: false, 
      data: null, 
      message: "User not found" 
    });

    // Verify old password
    const isOldPasswordValid = await user.comparePassword(oldPassword);
    if (!isOldPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "Current password is incorrect" 
      });
    }

    // Check if new password is different from old password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "New password must be different from current password",
      });
    }

    // Update password and invalidate refresh tokens for security
    user.password = newPassword; // Will be hashed by pre-save middleware
    user.refreshToken = null;
    user.refreshTokenExpiresAt = null;

    await user.save();

    res.status(200).json({
      success: true,
      data: null,
      message: "Password changed successfully. Please login again with your new password.",
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      data: null, 
      message: err.message 
    });
  }
};

module.exports = {
  login,
  register,
  refresh,
  logout,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
  changePassword,
};
