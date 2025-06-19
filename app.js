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
console.log("Port:", process.env.PORT || "3501");

var createError = require("http-errors");
var express = require("express");
var cors = require("cors");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

// Authentication middleware
const authMiddleware = require('./middleware/auth');

// Import all route files
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var productsRouter = require("./routes/products"); 
var categoriesRouter = require("./routes/categories");
var variantsRouter = require("./routes/variants");
var roomsRouter = require("./routes/rooms");
var wishlistsRouter = require("./routes/wishlists");
var ordersRouter = require("./routes/orders");
var orderStatusRouter = require("./routes/orderStatus");
var paymentsRouter = require("./routes/payments");
var contactFormsRouter = require("./routes/contactForms");
var couponcodesRouter = require("./routes/couponcodes");
var commentsRouter = require("./routes/comments");
var newsRouter = require("./routes/news");
var newsCategoriesRouter = require("./routes/newsCategories");
var authRouter = require("./routes/auth");
var debugRouter = require("./routes/debug");
var colorRouter = require("./routes/color");
var dashboardRouter = require("./routes/dashboard");

var app = express();

// App version and startup time for health checks
app.locals.version = require('./package.json').version || '1.0.0';
app.locals.startTime = new Date();

// Set up view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Configure express-ejs-layouts
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

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

// Base routes
app.use("/", indexRouter);
app.use("/api/auth", authRouter);
app.use("/dashboard", dashboardRouter);

// API routes - public
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/variants", variantsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/news", newsRouter);
app.use("/api/news-categories", newsCategoriesRouter);
app.use("/api/contact-forms", contactFormsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/debug", debugRouter);

// API routes - protected
app.use("/api/users", authMiddleware.verifyToken, usersRouter);
app.use("/api/wishlists", authMiddleware.verifyToken, wishlistsRouter);
app.use("/api/orders", authMiddleware.verifyToken, ordersRouter);
app.use("/api/order-status", authMiddleware.verifyToken, orderStatusRouter);
app.use("/api/payments", authMiddleware.verifyToken, paymentsRouter);
app.use("/api/couponcodes", authMiddleware.verifyToken, couponcodesRouter);
app.use("/api/color",colorRouter)

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  // Log the error for server-side debugging
  console.error(err);
  
  // Return JSON error response for API requests
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      error: {
        message: err.message,
        status: err.status || 500
      }
    });
  }
  
  // Render error page for web requests
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
