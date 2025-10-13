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
const paymentRoutes = require("./routes/payment/payment.route");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

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
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

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
app.use("/api/payments", paymentRoutes);

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
}).catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});

module.exports = app;
