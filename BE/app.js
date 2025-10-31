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
const paymentRoutes = require("./routes/payment/payment.route");
const feedbackRoutes = require("./routes/feedback/feedback.route");
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
app.use("/api/payments", paymentRoutes);
app.use('/api/feedback', feedbackRoutes);

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
}).catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});

module.exports = app;
