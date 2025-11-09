var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
require("dotenv").config();
const cors = require("cors"); // thêm cors
const User = require("./models/auth/auth.model")
const connectDB = require("./config/db.config");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./config/swagger");
const authRoutes = require("./routes/auth/auth.route");
const vehicleRoutes = require("./routes/vehicle/vehicle.route");
const transactionRoutes = require("./routes/transaction/transaction.route");
const userRoutes = require("./routes/user/user.route");
const stationRoutes = require("./routes/station/station.route");
const bookingRoutes = require("./routes/booking/booking.route");
const supportRoutes = require("./routes/support/support.route");
const staffRoutes = require("./routes/staff/staff.route");
const adminRoutes = require("./routes/admin/admin.route");
const batteryRoutes = require("./routes/battery/battery.route");
const batterySwapRoutes = require("./routes/battery/batterySwap.route");
const paymentRoutes = require("./routes/payment/payment.route");
const feedbackRoutes = require("./routes/feedback/feedback.route");
const aiRoutes = require("./routes/ai/ai.route");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

// Ensure correct client IP when behind proxies/tunnels (e.g., ngrok, cloudflare)
app.set("trust proxy", true);

// 👉 BỎ QUA trang cảnh báo của ngrok
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(logger("dev"));
app.use(express.static(path.join(__dirname, "public")));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  swaggerOptions: {
    tagsSorter: (a, b) => {
      const preferredOrder = [
        "Auth",
        "Users",
        "Stations",
        "Booking",
        "Payments",
        "Transactions",
        "Support",
        "Staff",
        "Vehicles",
        "Admin"
      ];
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    },
    operationsSorter: (a, b) => {
      const methodOrder = ["get", "post", "put", "delete", "patch"];
      const am = methodOrder.indexOf(a.get("method"));
      const bm = methodOrder.indexOf(b.get("method"));
      if (am !== bm) return am - bm;
      return a.get("path").localeCompare(b.get("path"));
    }
  }
}));

// Routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/batteries", batteryRoutes);
app.use("/api/battery-swap", batterySwapRoutes);
app.use("/api/payments", paymentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/ai', aiRoutes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

// Connect DB
connectDB().then(() => {
  console.log('Database connected successfully!');
  // Background job: close resolved support requests older than 1 day
  try {
    const SupportRequest = require('./models/support/supportRequest.model');
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const checkAndCloseStale = async () => {
      const cutoff = new Date(Date.now() - ONE_DAY);
      // Find resolved tickets older than 1 day (resolvedAt if set, otherwise use updatedAt)
      const q = {
        status: 'resolved',
        $or: [
          { resolvedAt: { $lte: cutoff } },
          { resolvedAt: null, updatedAt: { $lte: cutoff } }
        ]
      };
      const toClose = await SupportRequest.find(q).limit(200);
      if (toClose.length > 0) {
        const ids = toClose.map(t => t._id);
        const autoNote = 'Auto-closed: no driver response within 24 hours.';
        await SupportRequest.updateMany(
          { _id: { $in: ids } },
          { $set: { status: 'closed', closedAt: new Date(), closeNote: autoNote } }
        );
        console.log(`Auto-closed ${ids.length} stale support request(s)`);
      }
    };
    // run every hour
    setInterval(() => {
      checkAndCloseStale().catch(err => console.error('Error closing stale support requests:', err));
    }, 60 * 60 * 1000);
    // Run once at startup
    checkAndCloseStale().catch(err => console.error('Error closing stale support requests at startup:', err));
  } catch (err) {
    console.error('Background job for support requests failed to start:', err.message);
  }
  // Background job: auto-restore subscriptions whose end_date passed, if the plan wasn't updated by admin
  try {
    const SubscriptionPlan = require('./models/subscription/subscriptionPlan.model');
    const UserSubscription = require('./models/subscription/userSubscription.model');
    const ONE_DAY = 24 * 60 * 60 * 1000;

    const checkAndRestoreSubscriptions = async () => {
      const now = new Date();
      // Find subscriptions that have an end_date in the past and are not cancelled
      const q = {
        end_date: { $lte: now },
        status: { $ne: 'cancelled' },
      };
      const expiredSubs = await UserSubscription.find(q).limit(500);
      if (expiredSubs.length === 0) return;

      for (const sub of expiredSubs) {
        try {
          const plan = await SubscriptionPlan.findById(sub.plan);
          if (!plan) continue;

          // If admin updated the plan after the subscription was created, skip auto-restore
          if (plan.updatedAt && sub.createdAt && plan.updatedAt > sub.createdAt) {
            // admin changed plan after purchase — do not auto-restore
            continue;
          }

          // Reactivate the same subscription: set new start/end and reset remaining_swaps
          const start = new Date();
          let end = null;
          if (plan.durations && Number.isFinite(Number(plan.durations))) {
            const d = new Date(start);
            d.setMonth(d.getMonth() + Number(plan.durations));
            end = d;
          }
          const remaining_swaps = (plan.count_swap === null || plan.count_swap === undefined) ? null : plan.count_swap;

          sub.start_date = start;
          sub.end_date = end;
          sub.remaining_swaps = remaining_swaps;
          sub.status = 'active';
          await sub.save();
          console.log(`Auto-restored subscription ${sub._id} for user ${sub.user}`);
        } catch (errSub) {
          console.error('Failed to auto-restore subscription', sub._id, errSub.message || errSub);
        }
      }
    };

    // run every 24 hours
    setInterval(() => {
      checkAndRestoreSubscriptions().catch(err => console.error('Error in subscription auto-restore job:', err));
    }, ONE_DAY);

    // Run once at startup
    checkAndRestoreSubscriptions().catch(err => console.error('Error running subscription auto-restore at startup:', err));
  } catch (err) {
    console.error('Background job for subscription auto-restore failed to start:', err.message);
  }

  // Background job: Auto-expire slot reservations sau 15 phút
  try {
    const BatterySlot = require('./models/battery/batterySlot.model');
    const BatteryPillar = require('./models/battery/batteryPillar.model');

    const clearExpiredReservations = async () => {
      const now = new Date();

      // Tìm tất cả slots có reservation đã hết hạn
      const expiredSlots = await BatterySlot.find({
        status: 'reserved',
        'reservation.expiresAt': { $lte: now }
      }).populate('pillar');

      if (expiredSlots.length > 0) {
        console.log(`Found ${expiredSlots.length} expired slot reservation(s)`);

        for (const slot of expiredSlots) {
          try {
            // Restore slot status
            slot.status = slot.battery ? 'occupied' : 'empty';
            slot.reservation = undefined;
            await slot.save();

            console.log(`✅ Expired reservation cleared: Slot ${slot.slotCode} → ${slot.status}`);

            // Cập nhật pillar stats
            if (slot.pillar) {
              const pillar = await BatteryPillar.findById(slot.pillar._id || slot.pillar);
              if (pillar) {
                await pillar.updateSlotStats();
              }
            }
          } catch (err) {
            console.error(`Failed to clear reservation for slot ${slot.slotCode}:`, err.message);
          }
        }
      }
    };

    // Chạy mỗi 5 phút (hoặc 1 phút nếu muốn nhanh hơn)
    const FIVE_MINUTES = 5 * 60 * 1000;
    setInterval(() => {
      clearExpiredReservations().catch(err =>
        console.error('Error in clear expired reservations job:', err)
      );
    }, FIVE_MINUTES);

    // Chạy 1 lần khi startup
    clearExpiredReservations().catch(err =>
      console.error('Error running clear expired reservations at startup:', err)
    );

    console.log('✅ Background job started: Clear expired slot reservations (every 5 minutes)');
  } catch (err) {
    console.error('Background job for slot reservations failed to start:', err.message);
  }
}).catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});

module.exports = app;
