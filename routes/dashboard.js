const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { route } = require("./upload");

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res
      .status(403)
      .json({ error: "Access denied. Admin privileges required." });
  }
};

// Apply authentication middleware to all dashboard routes
// Tạm thời comment các middleware xác thực trong giai đoạn phát triển layout
// router.use(authMiddleware.verifyToken, isAdmin);

// Dashboard home
router.get("/", (req, res) => {
  res.render("dashboard/index", {
    title: "Sona Space - Dashboard",
    layout: "layouts/dashboard",
  });
});

// Dashboard home
router.get("/contact-forms-design", (req, res) => {
  res.render("dashboard/contact/contactformdesign", {
    title: "Sona Space - Contact Forms Design",
    layout: "layouts/dashboard",
  });
});

// Products management
router.get("/products", (req, res) => {
  res.render("dashboard/products/products", {
    title: "Sona Space - Quản lý Sản phẩm",
    layout: "layouts/dashboard",
  });
});

// Add product
router.get("dashboard/products/add", (req, res) => {
  res.render("dashboard/products-add", {
    title: "Sona Space - Thêm Sản phẩm mới",
    layout: "layouts/dashboard",
  });
});

// Edit product
router.get("/products/edit/:id", (req, res) => {
  res.render("dashboard/products-edit", {
    title: "Sona Space - Chỉnh sửa Sản phẩm",
    layout: "layouts/dashboard",
    productId: req.params.id,
  });
});

// Categories management
router.get("/categories", (req, res) => {
  res.render("dashboard/category/categories", {
    title: "Sona Space - Product Categories",
    layout: "layouts/dashboard",
  });
});

// Add category
router.get("/addcategories", (req, res) => {
  res.render("dashboard/category/addcategories", {
    title: "Sona Space - Thêm Danh mục",
    layout: "layouts/dashboard",
  });
});

// Edit category
router.get("/editcategories/:slug", (req, res) => {
  res.render("dashboard/category/editcategories", {
    title: "Sona Space - Chỉnh sửa Danh mục",
    layout: "layouts/dashboard",
  });
});

// Room management
router.get("/room", (req, res) => {
  res.render("dashboard/room/room", {
    title: "Sona Space - Quản lý Phòng",
    layout: "layouts/dashboard",
  });
});

router.get("/addroom", (req, res) => {
  res.render("dashboard/room/addroom", {
    title: "Sona Space - Quản lý Phòng",
    layout: "layouts/dashboard",
  });
});

router.get("/editroom/:slug", (req, res) => {
  res.render("dashboard/room/editroom", {
    title: "Sona Space - Chỉnh sửa Phòng",
    layout: "layouts/dashboard",
  });
});

// Orders management
router.get("/orders", (req, res) => {
  res.render("dashboard/orders", {
    title: "Orders Management",
    layout: "layouts/dashboard",
  });
});

// View specific order
router.get("/orders/view/:id", (req, res) => {
  res.render("dashboard/order-detail", {
    title: "Order Details",
    layout: "layouts/dashboard",
    orderId: req.params.id,
  });
});

// Users management
router.get("/users", (req, res) => {
  res.render("dashboard/users", {
    title: "Users Management",
    layout: "layouts/dashboard",
  });
});

// News management
router.get("/news", (req, res) => {
  res.render("dashboard/news", {
    title: "News Management",
    layout: "layouts/dashboard",
  });
});

// News Categories management
router.get("/news-categories", (req, res) => {
  res.render("dashboard/news-categories", {
    title: "Sona Space - Danh mục tin tức",
    layout: "layouts/dashboard",
  });
});

// Settings
router.get("/settings", (req, res) => {
  res.render("dashboard/settings", {
    title: "Settings",
    layout: "layouts/dashboard",
  });
});

// Profile
router.get("/profile", (req, res) => {
  res.render("dashboard/profile", {
    title: "Admin Profile",
    layout: "layouts/dashboard",
  });
});

module.exports = router;
