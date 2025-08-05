const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { route } = require("./upload");
const { isAdmin } = require("../middleware/auth");

// Middleware to check if user is admin
// Removed duplicate isAdmin middleware

// Middleware để kiểm tra xác thực cho dashboard
const checkAuth = (req, res, next) => {
  // Lấy token từ cookie hoặc header Authorization
  const token =
    req.cookies.token ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);

  if (!token) {
    return res.redirect("/");
  }

  try {
    // Xác thực token và gọi middleware tiếp theo
    authMiddleware.verifyToken(req, res, (err) => {
      if (err) {
        return res.redirect("/");
      }
      isAdmin(req, res, next);
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return res.redirect("/");
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
router.get("/material", (req, res) => {
  res.render("dashboard/material/material", {
    title: "Sona Space - Quản lý Sản phẩm",
    layout: "layouts/dashboard",
  });
});
router.get("/material/add", (req, res) => {
  res.render("dashboard/material/add", {
    title: "Sona Space - Quản lý Sản phẩm",
    layout: "layouts/dashboard",
  });
});
router.get("/material/edit/:slug", (req, res) => {
  // NO /dashboard HERE, because app.use('/dashboard', ...) already handles it
  res.render("dashboard/material/edit", {
    title: "Sona Space - Quản lý Sản phẩm",
    layout: "layouts/dashboard",
    productId: req.params.slug, // Pass the slug to the view
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

// Products management
router.get("/colors", (req, res) => {
  res.render("dashboard/colors/colors", {
    title: "Sona Space - Quản lý Sản phẩm",
    layout: "layouts/dashboard",
  });
});

// Add product
router.get("/colors/add", (req, res) => {
  res.render("dashboard/colors/add", {
    title: "Sona Space - Thêm Sản phẩm mới",
    layout: "layouts/dashboard",
  });
});

// Edit product
router.get("/colors/edit/:slug", (req, res) => {
  res.render("dashboard/colors/edit", {
    title: "Sona Space - Chỉnh sửa Sản phẩm",
    layout: "layouts/dashboard",
    productId: req.params.slug,
  });
});
// Products management
router.get("/events", (req, res) => {
  res.render("dashboard/events/events", {
    title: "Sona Space - Quản lý Sản phẩm",
    layout: "layouts/dashboard",
  });
});

// Add product
router.get("/events/add", (req, res) => {
  res.render("dashboard/events/add", {
    title: "Sona Space - Thêm Sản phẩm mới",
    layout: "layouts/dashboard",
  });
});

// Edit product
router.get("/events/edit/:slug", (req, res) => {
  res.render("dashboard/events/edit", {
    title: "Sona Space - Chỉnh sửa Sản phẩm",
    layout: "layouts/dashboard",
    productId: req.params.slug,
  });
});

// Products management
router.get("/comment", (req, res) => {
  res.render("dashboard/comment/comment", {
    title: "Sona Space - Quản lý Sản phẩm",
    layout: "layouts/dashboard",
  });
});

// Add product
router.get("/comment/add", (req, res) => {
  res.render("dashboard/comment/add", {
    title: "Sona Space - Thêm Sản phẩm mới",
    layout: "layouts/dashboard",
  });
});

// Edit product
router.get("/comment/edit/:slug", (req, res) => {
  res.render("dashboard/comment/edit", {
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

// notify management
router.get("/notify", (req, res) => {
  res.render("dashboard/notify/notify", {
    title: "Orders Management",
    layout: "layouts/dashboard",
  });
});
router.get("/notify/addNotify", (req, res) => {
  res.render("dashboard/notify/addNotify", {
    title: "Orders Management",
    layout: "layouts/dashboard",
  });
});

// notify type management
router.get("/typeNotify", (req, res) => {
  res.render("dashboard/typeNotify/typeNotify", {
    title: "Orders Management",
    layout: "layouts/dashboard",
  });
});

router.get("/typeNotify/addtypeNotify", (req, res) => {
  res.render("dashboard/typeNotify/addtypeNotify", {
    title: "Sona Space - Quản lý kiểu thông báo",
    layout: "layouts/dashboard",
  });
});

router.get("/typeNotify/edittypeNotify/:id", (req, res) => {
  res.render("dashboard/typeNotify/edittypeNotify", {
    title: "Sona Space - Chỉnh sửa kỉểu thông báo",
    layout: "layouts/dashboard",
  });
});

// voucher management
router.get("/voucher", (req, res) => {
  res.render("dashboard/voucher/voucher", {
    title: "Orders Management",
    layout: "layouts/dashboard",
  });
});
router.get("/voucher/addvoucher", (req, res) => {
  res.render("dashboard/voucher/addvoucher", {
    title: "Orders Management",
    layout: "layouts/dashboard",
  });
});
router.get("/voucher/editvoucher/:id", (req, res) => {
  res.render("dashboard/voucher/editvoucher", {
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

// Route for order details
router.get("/orders/detail/:id", isAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log(`Fetching order details for ID: ${orderId}`);

    // Build API URL based on environment
    const protocol = req.protocol;
    const host = req.get('host');
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? `${protocol}://${host}/api/orders/${orderId}`
      : `http://localhost:${process.env.PORT || 3501}/api/orders/${orderId}`;

    console.log(`Order detail API URL: ${apiUrl}`);

    // Fetch order data from API
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${req.cookies.token}`,
      },
    });

    if (!response.ok) {
      console.error(
        `API response not OK: ${response.status} ${response.statusText}`
      );
      throw new Error("Failed to fetch order details");
    }

    const orderData = await response.json();
    console.log(
      "API Response:",
      JSON.stringify(orderData).substring(0, 200) + "..."
    );

    // Extract the order object from the response
    const order = orderData.data || orderData;

    // If items are missing, fetch them directly from the database
    if (!order.items || order.items.length === 0) {
      console.log("No items found in API response, fetching from database");
      const db = require("../config/database");
      const [items] = await db.query(
        `
        SELECT oi.*, p.product_name, p.product_image, c.color_hex
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        LEFT JOIN color c ON vp.color_id = c.color_id
        WHERE oi.order_id = ? AND oi.deleted_at IS NULL
      `,
        [orderId]
      );

      console.log(`Found ${items.length} items in database`);
      order.items = items;
    }

    // Fetch payment method from payments table if not available in order
    if (!order.payment || !order.payment.length) {
      try {
        const db = require("../config/database");
        const [[paymentInfo]] = await db.query(
          `SELECT method, status, transaction_code, paid_at FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
          [orderId]
        );

        if (paymentInfo) {
          order.payment = [paymentInfo];
          console.log(`Found payment info:`, paymentInfo);
        } else {
          order.payment = [
            {
              method: "N/A",
              status: "PENDING",
              transaction_code: null,
              paid_at: null,
            },
          ];
        }
      } catch (error) {
        console.error("Error fetching payment method:", error);
        order.payment = [
          {
            method: "N/A",
            status: "PENDING",
            transaction_code: null,
            paid_at: null,
          },
        ];
      }
    }

    console.log(
      "Order payment before rendering:",
      JSON.stringify(order.payment)
    );
    console.log(
      "Payment status before rendering:",
      order.payment && order.payment.length > 0
        ? order.payment[0].status
        : "No payment data"
    );

    // Define available payment methods for dropdown
    const paymentMethods = ["COD", "BANK_TRANSFER", "VNPAY", "MOMO", "ZALOPAY"];

    // Process status logs to group by status type
    const statusLogs = order.status_logs || [];

    // Group status logs by type
    const paymentStatusLogs = statusLogs.filter(
      (log) =>
        log.to_status === "PENDING" ||
        log.to_status === "PROCESSING" ||
        log.to_status === "SUCCESS" ||
        log.to_status === "FAILED" ||
        log.to_status === "CANCELLED"
    );

    const orderStatusLogs = statusLogs.filter(
      (log) =>
        log.to_status === "PENDING" ||
        log.to_status === "CONFIRMED" ||
        log.to_status === "SHIPPING" ||
        log.to_status === "SUCCESS" ||
        log.to_status === "FAILED" ||
        log.to_status === "CANCELLED"
    );

    const shippingStatusLogs = statusLogs.filter(
      (log) =>
        log.to_status === "pending" ||
        log.to_status === "picking_up" ||
        log.to_status === "picked_up" ||
        log.to_status === "in_transit" ||
        log.to_status === "delivered" ||
        log.to_status === "delivery_failed" ||
        log.to_status === "returning" ||
        log.to_status === "returned" ||
        log.to_status === "canceled"
    );

    // Get the most recent log for each status type
    const latestPaymentLog =
      paymentStatusLogs.length > 0
        ? paymentStatusLogs[paymentStatusLogs.length - 1]
        : null;

    const latestOrderLog =
      orderStatusLogs.length > 0
        ? orderStatusLogs[orderStatusLogs.length - 1]
        : null;

    const latestShippingLog =
      shippingStatusLogs.length > 0
        ? shippingStatusLogs[shippingStatusLogs.length - 1]
        : null;

    // Helper functions for template
    const helpers = {
      mapPaymentStatus: (status) => {
        console.log("mapPaymentStatus called with:", status);
        switch (status) {
          case "PENDING":
            return "Chờ thanh toán";
          case "SUCCESS":
            return "Đã thanh toán";
          case "FAILED":
            return "Thanh toán thất bại";
          case "REFUNDED":
            return "Đã hủy";
          default:
            return status || "Chờ thanh toán";
        }
      },
      mapStatus: (status) => {
        switch (status) {
          case "PENDING":
            return "Chờ xác nhận";
          case "CONFIRMED":
            return "Đã xác nhận";
          case "SHIPPING":
            return "Đang giao";
          case "SUCCESS":
            return "Giao hàng thành công";
          case "FAILED":
            return "Thất bại";
          case "CANCELLED":
            return "Đã hủy";
          case "RETURN":
            return "Đang hoàn trả";
          default:
            return status || "Chờ xác nhận";
        }
      },
      mapShippingStatus: (status) => {
        switch (status) {
          case "pending":
            return "Chờ lấy hàng";
          case "picking_up":
            return "Đang đi lấy hàng";
          case "picked_up":
            return "Đã lấy hàng";
          case "in_transit":
            return "Đang vận chuyển";
          case "delivered":
            return "Đã giao hàng";
          case "delivery_failed":
            return "Giao hàng thất bại";
          case "returning":
            return "Đang hoàn trả";
          case "returned":
            return "Đã hoàn trả";
          case "canceled":
            return "Đã hủy";
          default:
            return status || "Chờ lấy hàng";
        }
      },
      mapShippingStatusClass: (status) => {
        switch (status) {
          case "pending":
            return "badge-secondary";
          case "picking_up":
            return "badge-info";
          case "picked_up":
            return "badge-primary";
          case "in_transit":
            return "badge-primary";
          case "delivered":
            return "badge-success";
          case "delivery_failed":
            return "badge-danger";
          case "returning":
            return "badge-warning";
          case "returned":
            return "badge-warning";
          case "canceled":
            return "badge-dark";
          default:
            return "badge-secondary";
        }
      },
      mapShippingStatusIcon: (status) => {
        switch (status) {
          case "pending":
            return "fa-clock";
          case "picking_up":
            return "fa-people-carry";
          case "picked_up":
            return "fa-box";
          case "in_transit":
            return "fa-truck";
          case "delivered":
            return "fa-check-circle";
          case "delivery_failed":
            return "fa-times-circle";
          case "returning":
            return "fa-undo";
          case "returned":
            return "fa-box-open";
          case "canceled":
            return "fa-ban";
          default:
            return "fa-clock";
        }
      },
      formatPrice: (price) => {
        if (!price) return "0";
        try {
          return parseFloat(price).toLocaleString("vi-VN");
        } catch (error) {
          console.error("Error formatting price:", error);
          return "0";
        }
      },
      formatDateTime: (dateTimeStr) => {
        if (!dateTimeStr) return "";
        try {
          const date = new Date(dateTimeStr);
          return date.toLocaleString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        } catch (error) {
          console.error("Error formatting date:", error);
          return dateTimeStr;
        }
      },
    };

    console.log("Rendering order detail template with data");
    res.render("dashboard/orders/order-detail", {
      title: `Chi tiết đơn hàng #${orderId}`,
      layout: "layouts/dashboard",
      orderId,
      order,
      paymentMethods,
      statusLogs: {
        payment: paymentStatusLogs,
        order: orderStatusLogs,
        shipping: shippingStatusLogs,
        latestPayment: latestPaymentLog,
        latestOrder: latestOrderLog,
        latestShipping: latestShippingLog,
      },
      mapPaymentStatus: helpers.mapPaymentStatus,
      mapStatus: helpers.mapStatus,
      mapShippingStatus: helpers.mapShippingStatus,
      mapShippingStatusClass: helpers.mapShippingStatusClass,
      mapShippingStatusIcon: helpers.mapShippingStatusIcon,
      formatPrice: helpers.formatPrice,
      formatDateTime: helpers.formatDateTime,
    });
  } catch (error) {
    console.error("Error loading order details:", error);
    res.status(500).render("error", {
      message: "Không thể tải thông tin đơn hàng",
      error: { status: 500, stack: error.stack },
      layout: "layouts/dashboard",
    });
  }
});

// View order invoice
router.get("/orders/invoice/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log(`Fetching invoice for order ID: ${orderId}`);

    // Build API URL based on environment
    const protocol = req.protocol;
    const host = req.get('host');
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? `${protocol}://${host}/api/orders/${orderId}`
      : `http://localhost:${process.env.PORT || 3501}/api/orders/${orderId}`;

    console.log(`Invoice API URL: ${apiUrl}`);

    // Fetch order data from API
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${req.cookies.token}`,
      },
    });

    if (!response.ok) {
      console.error(
        `API response not OK: ${response.status} ${response.statusText}`
      );
      throw new Error("Failed to fetch order details for invoice");
    }

    const orderData = await response.json();
    console.log(
      "API Response for invoice:",
      JSON.stringify(orderData).substring(0, 200) + "..."
    );

    // Extract the order object from the response
    const order = orderData.data || orderData;

    // If items are missing, fetch them directly from the database
    if (!order.items || order.items.length === 0) {
      console.log(
        "No items found in API response, fetching from database for invoice"
      );
      const db = require("../config/database");
      const [items] = await db.query(
        `
        SELECT oi.*, p.product_name, vp.variant_product_price, vp.variant_product_price_sale
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        WHERE oi.order_id = ? AND oi.deleted_at IS NULL
      `,
        [orderId]
      );

      console.log(`Found ${items.length} items in database for invoice`);
      order.items = items;
    }

    // Calculate totals if not already provided
    if (!order.subtotal) {
      const subtotal = order.items.reduce((sum, item) => {
        const price = item.price_sale || item.price || item.product_price || 0;
        return sum + price * item.quantity;
      }, 0);

      order.subtotal = subtotal;
      order.shipping_fee = order.shipping_fee || order.shippingFee || 0;
      order.discount = order.discount || order.order_discount || 0;
      order.tax = order.tax || subtotal * 0.08; // Giả sử thuế VAT 8%
      order.total_amount =
        order.total_amount ||
        order.order_total_final ||
        order.total ||
        subtotal + order.shipping_fee + order.tax - order.discount;
    }

    // Prepare customer information
    order.customer_name =
      order.recipientName ||
      order.order_name_new ||
      order.order_name_old ||
      order.user_name;
    order.customer_email =
      order.recipientEmail ||
      order.order_email_new ||
      order.order_email_old ||
      order.user_email;
    order.customer_phone =
      order.recipientPhone ||
      order.order_number2 ||
      order.order_number1 ||
      order.user_phone;
    order.shipping_address =
      order.address || order.order_address_new || order.order_address_old;

    // Helper functions for template
    const mapPaymentStatus = (status) => {
      switch (status) {
        case "PENDING":
          return "Chờ thanh toán";
        case "PROCESSING":
          return "Đang xử lý";
        case "SUCCESS":
          return "Đã thanh toán";
        case "FAILED":
          return "Thanh toán thất bại";
        case "CANCELLED":
          return "Đã hủy";
        default:
          return status || "Chờ thanh toán";
      }
    };

    const mapShippingStatus = (status) => {
      switch (status) {
        case "pending":
          return "Chờ lấy hàng";
        case "picking_up":
          return "Đang đi lấy hàng";
        case "picked_up":
          return "Đã lấy hàng";
        case "in_transit":
          return "Đang vận chuyển";
        case "delivered":
          return "Đã giao hàng";
        case "delivery_failed":
          return "Giao hàng thất bại";
        case "returning":
          return "Đang hoàn trả";
        case "returned":
          return "Đã hoàn trả";
        case "canceled":
          return "Đã hủy";
        default:
          return status || "Chờ lấy hàng";
      }
    };

    console.log("Rendering invoice template with data");
    console.log(
      "Order data:",
      JSON.stringify({
        id: order.order_id || order.id,
        customer: order.customer_name,
        items_count: order.items?.length || 0,
      })
    );

    res.render("dashboard/orders/order-invoice", {
      title: "Order Invoice",
      layout: false, // Không sử dụng layout để in hóa đơn dễ dàng
      orderId: orderId,
      order: order,
      mapPaymentStatus,
      mapShippingStatus,
    });
  } catch (error) {
    console.error("Lỗi khi hiển thị hóa đơn:", error);
    res.status(500).send("Đã xảy ra lỗi khi tải hóa đơn: " + error.message);
  }
});

// Users management
router.get("/users", (req, res) => {
  res.render("dashboard/users/users", {
    title: "Users Management",
    layout: "layouts/dashboard",
  });
});
router.get("/users/edit", (req, res) => {
  res.render("dashboard/users/edit", {
    title: "Sona Space - Chỉnh sửa thông tin người dùng",
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

router.get("/news/addnews", (req, res) => {
  res.render("dashboard/news/addnews", {
    title: "Sona Space - Quản lý tin tức",
    layout: "layouts/dashboard",
  });
});

router.get("/news/editnews/:slug", (req, res) => {
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
router.get("/Categorynews/addcategorynews", (req, res) => {
  res.render("dashboard/Categorynews/addcategorynews", {
    title: "Sona Space - Quản lý tin tức",
    layout: "layouts/dashboard",
  });
});

router.get("/Categorynews/editcategorynews/:slug", (req, res) => {
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
  res.render("dashboard/banner/add", {
    title: "Sona Space - Thêm Banner mới",
    layout: "layouts/dashboard",
  });
});

// Edit banner
router.get("/banners/edit/:id", (req, res) => {
  res.render("dashboard/banner/edit", {
    title: "Sona Space - Chỉnh sửa Banner",
    layout: "layouts/dashboard",
    bannerId: req.params.id,
  });
});

module.exports = router;
