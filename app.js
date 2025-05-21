// Load environment variables from .env file
const dotenv = require("dotenv");
const result = dotenv.config();

// Log environment loading status
if (result.error) {
  console.warn("Warning: .env file not found or cannot be read.");
} else {
  console.log("Environment variables loaded from .env file");
}

// Log important environment variables for debugging
console.log("Environment:", process.env.NODE_ENV || "development");
console.log("Port:", process.env.PORT || "3500");

var createError = require("http-errors");
var express = require("express");
var cors = require("cors");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var productsRouter = require("./routes/products"); 
var categoriesRouter = require("./routes/categories");

var app = express();

// App version and startup time for health checks
app.locals.version = require('./package.json').version || '1.0.0';
app.locals.startTime = new Date();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

// Add a health check endpoint
app.get('/health', function(req, res) {
  res.json({
    status: 'ok',
    uptime: Math.floor((new Date() - app.locals.startTime) / 1000),
    version: app.locals.version,
    env: process.env.NODE_ENV
  });
});

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
