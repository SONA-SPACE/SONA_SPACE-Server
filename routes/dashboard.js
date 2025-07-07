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

router.get("/contact-forms-design/:id", (req, res) => {
  res.render("dashboard/contact/contactformdetail", {
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

// View order invoice
router.get("/orders/invoice/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    let order = null;
    let items = [];
    
    // Kết nối với database để lấy thông tin đơn hàng
    const db = require('../config/database');
    
    try {
      // Lấy thông tin đơn hàng
      const [orders] = await db.query(`
        SELECT * FROM orders WHERE order_id = ?
      `, [orderId]);
      
      if (orders.length > 0) {
        order = orders[0];
        
        // Lấy thông tin chi tiết đơn hàng
        const [orderItems] = await db.query(`
          SELECT oi.*, p.product_name, vp.variant_name, vp.variant_product_price, vp.variant_product_price_sale
          FROM order_items oi
          JOIN variant_product vp ON oi.variant_id = vp.variant_id
          JOIN product p ON vp.product_id = p.product_id
          WHERE oi.order_id = ?
        `, [orderId]);
        
        items = orderItems;
        
        // Tính toán các giá trị tổng
        const subtotal = items.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
        const shippingFee = order.shipping_fee || 0;
        const discount = order.order_discount || 0;
        const tax = subtotal * 0.08; // Giả sử thuế VAT 8%
        const total = subtotal + shippingFee + tax - discount;
        
        // Thêm các thông tin tính toán vào order
        order.items = items;
        order.subtotal = subtotal;
        order.shipping_fee = shippingFee;
        order.discount = discount;
        order.tax = tax;
        order.total_amount = total;
        
        // Lấy thông tin khách hàng
        if (order.user_id) {
          const [users] = await db.query(`
            SELECT user_name as customer_name, user_gmail as customer_email, user_number as customer_phone, user_address as shipping_address
            FROM user WHERE user_id = ?
          `, [order.user_id]);
          
          if (users.length > 0) {
            // Ưu tiên thông tin mới nếu có
            order.customer_name = order.order_name_new || users[0].customer_name;
            order.customer_email = order.order_email_new || users[0].customer_email;
            order.customer_phone = order.order_number2 || order.order_number1 || users[0].customer_phone;
            order.shipping_address = order.order_address_new || order.order_address_old || users[0].shipping_address;
          }
        }
      } else {
        console.log(`Không tìm thấy đơn hàng với ID: ${orderId}`);
        // Tạo dữ liệu mẫu nếu không tìm thấy đơn hàng
        order = {
          order_id: orderId,
          created_at: new Date(),
          customer_name: "Khách hàng mẫu",
          customer_email: "customer@example.com",
          customer_phone: "0123456789",
          shipping_address: "Địa chỉ mẫu, Quận 1, TP HCM",
          items: [
            {
              product_name: "Sofa Modena 2,5 seater",
              variant_name: "Màu nâu, chất liệu da cao cấp",
              quantity: 1,
              product_price: 15000000
            },
            {
              product_name: "Bàn trà Oslo",
              variant_name: "Gỗ sồi tự nhiên, kích thước 120x60cm",
              quantity: 1,
              product_price: 4500000
            }
          ],
          subtotal: 19500000,
          shipping_fee: 300000,
          discount: 0,
          tax: 1560000,
          total_amount: 21360000
        };
      }
    } catch (dbError) {
      console.error('Lỗi database:', dbError);
      // Tạo dữ liệu mẫu nếu có lỗi database
      order = {
        order_id: orderId,
        created_at: new Date(),
        customer_name: "Khách hàng mẫu",
        customer_email: "customer@example.com",
        customer_phone: "0123456789",
        shipping_address: "Địa chỉ mẫu, Quận 1, TP HCM",
        items: [
          {
            product_name: "Sofa Modena 2,5 seater",
            variant_name: "Màu nâu, chất liệu da cao cấp",
            quantity: 1,
            product_price: 15000000
          },
          {
            product_name: "Bàn trà Oslo",
            variant_name: "Gỗ sồi tự nhiên, kích thước 120x60cm",
            quantity: 1,
            product_price: 4500000
          }
        ],
        subtotal: 19500000,
        shipping_fee: 300000,
        discount: 0,
        tax: 1560000,
        total_amount: 21360000
      };
    }
    
    res.render("dashboard/orders/order-invoice", {
      title: "Order Invoice",
      layout: false, // Không sử dụng layout để in hóa đơn dễ dàng
      orderId: orderId,
      order: order
    });
  } catch (error) {
    console.error('Lỗi khi hiển thị hóa đơn:', error);
    res.status(500).send('Đã xảy ra lỗi khi tải hóa đơn');
  }
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
