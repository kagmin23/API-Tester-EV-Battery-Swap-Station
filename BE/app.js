var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
require("dotenv").config();
const cors = require("cors"); // thêm cors
const User = require("./models/auth/auth.model")
const connectDB = require("./config/db.config");
const authRoutes = require("./routes/auth/auth.route");
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

// Routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/api/auth", authRoutes);

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
