const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { route } = require("./upload");

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    // Chuyển hướng về trang đăng nhập nếu không phải admin
    res.redirect('/');
  }
};

// Middleware để kiểm tra xác thực cho dashboard
const checkAuth = (req, res, next) => {
  // Lấy token từ cookie hoặc header Authorization
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  
  if (!token) {
    return res.redirect('/');
  }
  
  try {
    // Xác thực token và gọi middleware tiếp theo
    authMiddleware.verifyToken(req, res, (err) => {
      if (err) {
        return res.redirect('/');
      }
      isAdmin(req, res, next);
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.redirect('/');
  }
};

// Apply authentication middleware to all dashboard routes
router.use(checkAuth);

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
router.get("/products/add", (req, res) => {
  res.render("dashboard/products/add", {
    title: "Sona Space - Thêm Sản phẩm mới",
    layout: "layouts/dashboard",
  });
});


// Edit product
router.get("/products/edit/:slug", (req, res) => {
  res.render("dashboard/products/edit", {
    title: "Sona Space - Chỉnh sửa Sản phẩm",
    layout: "layouts/dashboard",
    productId: req.params.slug,
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
  res.render("dashboard/orders/orders", {
    title: "Orders Management",
    layout: "layouts/dashboard",
  });
});

// View specific order
router.get("/orders/view/:id", (req, res) => {
  res.render("dashboard/orders/order-detail", {
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
  res.render("dashboard/news/news", {
    title: "News Management",
    layout: "layouts/dashboard",
  });
});

router.get("/addnews", (req, res) => {
  res.render("dashboard/news/addnews", {
    title: "Sona Space - Quản lý tin tức",
    layout: "layouts/dashboard",
  });
});

router.get("/editnews/:slug", (req, res) => {
  res.render("dashboard/news/editnews", {
    title: "Sona Space - Chỉnh sửa tin tức",
    layout: "layouts/dashboard",
    productId: req.params.slug,
  });
});
// News Categories management
router.get("/Categorynews", (req, res) => {
  res.render("dashboard/Categorynews/Categorynews", {
    title: "Sona Space - Danh mục tin tức",
    layout: "layouts/dashboard",
  });
});
router.get("/addcategorynews", (req, res) => {
  res.render("dashboard/Categorynews/addcategorynews", {
    title: "Sona Space - Quản lý tin tức",
    layout: "layouts/dashboard",
  });
});

router.get("/editcategorynews/:slug", (req, res) => {
  res.render("dashboard/Categorynews/editcategorynews", {
    title: "Sona Space - Chỉnh sửa tin tức",
    layout: "layouts/dashboard",
    productId: req.params.slug,
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

// Banner management
router.get("/banners", (req, res) => {
  res.render("dashboard/banner/banners", {
    title: "Sona Space - Quản lý Banner",
    layout: "layouts/dashboard",
  });
});

// Add banner
router.get("/banners/add", (req, res) => {
  res.render("dashboard/banner/add-banner", {
    title: "Sona Space - Thêm Banner mới",
    layout: "layouts/dashboard",
  });
});

// Edit banner
router.get("/banners/edit/:id", (req, res) => {
  res.render("dashboard/banner/edit-banner", {
    title: "Sona Space - Chỉnh sửa Banner",
    layout: "layouts/dashboard",
    bannerId: req.params.id,
  });
});

module.exports = router;
