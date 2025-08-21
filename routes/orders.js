const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin, optionalAuth } = require("../middleware/auth");
const crypto = require("crypto");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");

const axios = require("axios");
const { sendEmail1 } = require("../services/mailService1");
const { VNPay, ignoreLogger, dateFormat } = require("vnpay");
// Áp dụng middleware xác thực cho tất cả các route
// router.use(verifyToken);
function formatDateVNPay(date) {
  const yyyy = date.getFullYear().toString();
  const MM = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const HH = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}
/**
 * @route   GET /api/orders/count
 * @desc    Lấy số lượng đơn hàng theo trạng thái (chỉ admin)
 * @access  Private (Admin)
 */

router.get("/test-email", async (req, res) => {
  const result = await sendEmail1(
    "totrongnhan1209@example.com", // email test thật
    "Test đơn hàng",
    {
      name: "Nguyễn Văn A",
      order_id: "TEST123",
      amount: 500000,
      method: "COD",
      address: "123 Lê Lợi, Q.1, TP.HCM",
    }
  );
  res.json({ result });
});

router.get("/complete/:orderHash", optionalAuth, async (req, res) => {
  const { orderHash } = req.params;
  try {
    const [[order]] = await db.query(
      `
      SELECT 
        o.order_id,
        o.order_hash,
        o.created_at,
        o.order_total_final,
        (
          SELECT SUM(oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = o.order_id
        ) AS total_quantity
      FROM orders o
      WHERE o.order_hash = ?
    `,
      [orderHash]
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    return res.status(200).json({
      success: true,
      order: {
        order_id: order.order_id,
        order_hash: order.order_hash,
        created_at: order.created_at,
        order_total_final: order.order_total_final,
        total_quantity: order.total_quantity || 0,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
});

router.get("/hash/:orderHash", optionalAuth, async (req, res) => {
  const { orderHash } = req.params;

  try {
    const [[order]] = await db.query(
      `
      SELECT   
        o.order_id,
        o.order_hash,
        o.created_at,
        o.current_status,
        o.shipping_status,
        o.order_address_old,
        o.order_address_new,
        o.order_number1,
        o.order_number2,
        o.order_total,
        o.order_total_final,
        o.shipping_fee,
        o.order_discount,
        o.user_id,
        o.order_name_new,
        o.order_email_new,
        u.user_name AS order_name_old,
        u.user_gmail AS order_email_old,
        cc.code AS coupon_code,
        cc.value_price AS coupon_value,
        p.status AS payment_status
        
      FROM orders o
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN couponcode cc ON o.couponcode_id = cc.couponcode_id
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE o.order_hash = ?
    `,
      [orderHash]
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    // Lấy thông tin hủy/trả đơn hàng từ bảng order_returns nếu đơn hàng có trạng thái CANCELLED hoặc RETURN
    let returnInfo = null;
    if (
      order.current_status === "CANCELLED" ||
      order.current_status === "RETURN"
    ) {
      const [orderReturns] = await db.query(
        `
        SELECT 
          return_id,
          reason,
          return_type,
          total_refund,
          status as return_status,
          created_at as return_created_at,
          updated_at as return_updated_at
        FROM order_returns 
        WHERE order_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [order.order_id]
      );

      if (orderReturns.length > 0) {
        returnInfo = orderReturns[0];
      }
    }

    const [items] = await db.query(
      `
      SELECT 
        oi.order_item_id AS id,
        oi.quantity,
        vp.variant_id,
  CAST(REPLACE(vp.variant_product_price, '.', '') AS UNSIGNED) AS price,
  CAST(REPLACE(vp.variant_product_price_sale, '.', '') AS UNSIGNED) AS price_sale,
        vp.variant_product_list_image AS image,
        c.color_name,
        c.color_hex,
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_image AS product_image,
        cat.category_name AS category,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) AS comment_count,
      (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) AS average_rating,
  IF(oi.comment_id IS NOT NULL, TRUE, FALSE) AS has_comment
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      WHERE oi.order_id = ?
    `,
      [order.order_id]
    );

    const statusStepMap = {
      // Quy trình đặt hàng thành công
      PENDING: 1,
      APPROVED: 2,
      CONFIRMED: 2, // Tương đương với APPROVED
      SHIPPING: 3,
      COMPLETED: 4,
      SUCCESS: 4, // Tương đương với COMPLETED

      // Quy trình hủy đơn hàng (từ bảng order_returns)
      CANCEL_REQUESTED: 1, // Khách hàng yêu cầu hủy
      CANCEL_PENDING: 2, // Đang chờ xử lý hủy
      CANCEL_CONFIRMED: 3, // Xác nhận hủy
      CANCELLED: 4, // Đã hủy hoàn tất

      // Quy trình trả hàng
      RETURN: 4, // Đã trả hàng hoàn tất

      // Quy trình từ chối/thất bại
      REJECTED: 4, // Đơn hàng bị từ chối - trạng thái cuối
      FAILED: 1, // Đơn hàng thất bại
    };

    // Xác định loại quy trình và step dựa trên trạng thái
    let processType = "normal"; // Quy trình bình thường
    let actualStatus = order.current_status;
    let statusStep = statusStepMap[order.current_status] || 1;

    // Kiểm tra xem đơn hàng có trong bảng order_returns không
    if (
      (order.current_status === "CANCELLED" ||
        order.current_status === "RETURN") &&
      returnInfo
    ) {
      if (order.current_status === "CANCELLED") {
        processType = "cancellation";
      } else if (order.current_status === "RETURN") {
        processType = "return";
      }
      actualStatus = returnInfo.return_status;
      statusStep =
        statusStepMap[returnInfo.return_status] ||
        statusStepMap[order.current_status] ||
        4;
    } else if (["REJECTED", "FAILED"].includes(order.current_status)) {
      processType = "failed";
    }

    const cleanPrice = (value) => {
      if (!value) return 0;
      const cleaned = String(value).replace(/\./g, "");
      return Number(cleaned);
    };

    // Ưu tiên thông tin mới nếu có, fallback về thông tin cũ
    const recipientName =
      order.order_name_new?.trim() ||
      order.order_name_old?.trim() ||
      "Khách hàng";
    const recipientEmail =
      order.order_email_new?.trim() || order.order_email_old?.trim() || "";
    const recipientPhone =
      order.order_number2?.trim() || order.order_number1?.trim() || "";
    const recipientAddress =
      order.order_address_new?.trim() || order.order_address_old?.trim() || "";

    const orderData = {
      id: order.order_id,
      order_hash: order.order_hash,
      date: order.created_at,
      status: order.current_status,
      statusStep,
      processType, // Thêm thông tin loại quy trình
      couponCode: order.coupon_code || "",
      couponValue: order.coupon_value || "",
      recipientName,
      recipientEmail,
      recipientPhone,
      address: recipientAddress,
      order_name_old: order.order_name_old || "",
      order_name_new: order.order_name_new || "",
      order_email_old: order.order_email_old || "",
      order_email_new: order.order_email_new || "",
      order_address_old: order.order_address_old || "",
      order_address_new: order.order_address_new || "",
      order_number1: order.order_number1 || "",
      order_number2: order.order_number2 || "",
      paymentStatus: order.payment_status,
      shippingStatus: order.shipping_status || "pending",
      subtotal: order.order_total,
      shippingFee: Number(order.shipping_fee) || 0,
      discount: Number(order.order_discount) || 0,
      total: order.order_total_final,

      products: items.map((item) => ({
        id: item.id,
        name: item.product_name,
        image: item.image || item.product_image || "/images/default.jpg",
        price: item.price_sale
          ? cleanPrice(item.price_sale)
          : cleanPrice(item.price),
        quantity: item.quantity,
        slug: item.product_slug,
        color: {
          name: item.color_name,
          hex: item.color_hex,
        },
        category: item.category,
        rating: {
          count: item.comment_count,
          average: item.average_rating,
        },
        has_comment: item.has_comment,
      })),
    };

    // Thêm thông tin return nếu có
    if (returnInfo) {
      orderData.returnInfo = {
        return_id: returnInfo.return_id,
        reason: returnInfo.reason,
        return_type: returnInfo.return_type,
        total_refund: returnInfo.total_refund,
        return_status: returnInfo.return_status,
        return_created_at: returnInfo.return_created_at,
        return_updated_at: returnInfo.return_updated_at,
      };
    }

    return res.status(200).json({
      success: true,
      order: orderData,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
});

// GET /api/orders/admin
router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT 
        o.order_id,
        o.order_hash,
        o.created_at,
        o.current_status,
        o.payment_status,
        o.shipping_status,
        o.order_total_final,
        o.order_name_new,
        o.order_name_old,
        u.user_name,
        p.method as payment_method,
        p.status as payment_status_from_payment,
        COUNT(oi.order_item_id) AS item_count,
        -- Thêm thông tin return từ bảng order_returns
        or_latest.return_status,
        or_latest.return_reason,
        or_latest.return_type,
        or_latest.total_refund,
        or_latest.return_created_at,
        or_latest.return_updated_at
      FROM orders o
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN (
        SELECT order_id, method, status
        FROM payments 
        WHERE payment_id IN (
          SELECT MAX(payment_id) 
          FROM payments 
          GROUP BY order_id
        )
      ) p ON o.order_id = p.order_id
      LEFT JOIN (
        -- Lấy thông tin return mới nhất cho mỗi order
        SELECT 
          order_id,
          status as return_status,
          reason as return_reason,
          return_type,
          total_refund,
          created_at as return_created_at,
          updated_at as return_updated_at
        FROM order_returns 
        WHERE return_id IN (
          SELECT MAX(return_id) 
          FROM order_returns 
          GROUP BY order_id
        )
      ) or_latest ON o.order_id = or_latest.order_id
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
    `);

    // Process orders to include payment array and return info
    const processedOrders = orders.map((order) => {
      // Create payment array if payment data exists
      if (order.payment_method || order.payment_status_from_payment) {
        order.payment = [
          {
            method: order.payment_method || "N/A",
            status:
              order.payment_status_from_payment ||
              order.payment_status ||
              "PENDING",
            transaction_code: null,
            paid_at: null,
          },
        ];
      }

      // Add return info if exists
      if (order.return_status) {
        order.returnInfo = {
          return_status: order.return_status,
          reason: order.return_reason,
          return_type: order.return_type,
          total_refund: order.total_refund,
          return_created_at: order.return_created_at,
          return_updated_at: order.return_updated_at,
        };
      }

      // Remove the extra fields used for processing
      delete order.payment_status_from_payment;
      delete order.return_status;
      delete order.return_reason;
      delete order.return_type;
      delete order.total_refund;
      delete order.return_created_at;
      delete order.return_updated_at;

      return order;
    });

    res.json({ success: true, orders: processedOrders });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

router.get("/count", async (req, res) => {
  try {
    // Lấy số lượng đơn hàng theo trạng thái
    const [result] = await db.query(`
      SELECT current_status, COUNT(*) as count
      FROM \`orders\`
      GROUP BY current_status
    `);

    // Lấy danh sách các trạng thái có thể có
    const statuses = [
      { status: "PENDING", name: "Chờ xác nhận" },
      { status: "CONFIRMED", name: "Đã xác nhận" },
      { status: "SHIPPING", name: "Đang giao" },
      { status: "SUCCESS", name: "Giao hàng thành công" },
      { status: "FAILED", name: "Thất bại" },
      { status: "CANCELLED", name: "Đã hủy" },
      { status: "RETURN", name: "Đã trả hàng" },
    ];

    // Tạo đối tượng thống kê
    const statistics = statuses.map((status) => {
      const count = result.find((r) => r.current_status === status.status);
      return {
        status: status.status,
        status_name: status.name,
        count: count ? count.count : 0,
      };
    });

    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: "Failed to count orders" });
  }
});

/**
 * @route   GET /api/orders
 * @desc    Lấy danh sách tất cả đơn hàng (admin only)
 * @access  Private (Admin)
 */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status; // Changed from status_id to status
    const search = req.query.search;
    // Xây dựng điều kiện tìm kiếm
    let conditions = [];
    let params = [];

    // Lọc theo trạng thái
    if (status) {
      conditions.push("o.current_status = ?");
      params.push(status);
    }

    if (search) {
      conditions.push(
        "(o.order_hash LIKE ? OR u.user_gmail LIKE ? OR u.user_name LIKE ?)"
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    // Đếm tổng số đơn hàng
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM \`orders\` o
      LEFT JOIN user u ON o.user_id = u.user_id
      ${whereClause}
    `;
    try {
      const [countResult] = await db.query(countQuery, params);
      const totalOrders = countResult[0].total;
      const totalPages = Math.ceil(totalOrders / limit);

      // Lấy danh sách đơn hàng với phân trang
      const ordersQuery = `
        SELECT 
          o.*,
          u.user_gmail as user_email,
          u.user_name as user_name
        FROM \`orders\` o
        LEFT JOIN user u ON o.user_id = u.user_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ?, ?
      `;
      const [orders] = await db.query(ordersQuery, [...params, offset, limit]);
      res.json({
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalOrders,
          ordersPerPage: limit,
        },
      });
    } catch (dbError) {
      throw dbError;
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch orders", details: error.message });
  }
});

/**
 * @route   POST /api/orders
 * @desc    Tạo đơn hàng mới
 * @access  Private
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      order_id,
      order_total,
      order_total_final,
      method,
      amount,
      order_hash,
      order_address_new,
      order_number2,
      order_name_new,
      order_email_new,
      couponcode_id,
      cart_items = [],
      coupon_code,
      shipping_fee,
      order_discount,
      fromRedirect,
    } = req.body;

    const user_id = req.user.id;

    if (!order_id || !order_total || !method || !amount) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    if (method === "MOMO" && !fromRedirect) {
      return res
        .status(400)
        .json({ error: "Chờ IPN hoặc fromRedirect mới được tạo đơn" });
    }
    // Lấy thông tin người dùng
    const [[userInfo]] = await db.query(
      `SELECT user_address, user_number, user_name, user_gmail FROM user WHERE user_id = ?`,
      [user_id]
    );
    if (!userInfo) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Chuẩn hóa dữ liệu người dùng
    const defaultName = userInfo.user_name?.trim() || "";
    const defaultEmail = userInfo.user_gmail?.trim() || "";
    const defaultAddress = userInfo.user_address?.trim() || "";
    const defaultPhone = userInfo.user_number?.trim() || "";

    const orderNameNew =
      order_name_new?.trim() && order_name_new.trim() !== defaultName
        ? order_name_new.trim()
        : null;
    const orderEmailNew =
      order_email_new?.trim() && order_email_new.trim() !== defaultEmail
        ? order_email_new.trim()
        : null;
    const finalAddressNew =
      order_address_new?.trim() && order_address_new.trim() !== defaultAddress
        ? order_address_new.trim()
        : null;
    const finalNumber2 =
      order_number2?.trim() && order_number2.trim() !== defaultPhone
        ? order_number2.trim()
        : null;

    let couponcodeId = couponcode_id || null;
    if (!couponcodeId && coupon_code) {
      const [[coupon]] = await db.query(
        `SELECT couponcode_id FROM couponcode WHERE code = ?`,
        [coupon_code]
      );
      if (coupon) couponcodeId = coupon.couponcode_id;
    }

    // COD: xử lý ngay
    if (method === "COD") {
      const [existingOrders] = await db.query(
        "SELECT * FROM orders WHERE order_hash = ?",
        [order_id]
      );
      if (existingOrders.length > 0) {
        return res.status(400).json({ error: "Đơn hàng đã tồn tại" });
      }

      await db.query(
        `
          INSERT INTO orders (
            order_hash, user_id, order_address_old, order_address_new,
            order_number1, order_number2, order_total, order_total_final,
              shipping_fee, order_discount,  
            current_status, created_at,
            order_name_old, order_name_new,
            order_email_old, order_email_new,
            couponcode_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [
          order_id,
          user_id,
          defaultAddress,
          finalAddressNew,
          defaultPhone,
          finalNumber2,
          order_total,
          order_total_final,
          shipping_fee,
          order_discount,
          "PENDING",
          defaultName,
          orderNameNew,
          defaultEmail,
          orderEmailNew,
          couponcodeId,
        ]
      );

      const [[orderRow]] = await db.query(
        `SELECT order_id, order_hash FROM orders WHERE order_hash = ?`,
        [order_id, order_hash]
      );
      const orderId = orderRow.order_id;
      const orderHash = orderRow.order_hash;

      for (const item of cart_items) {
        const {
          variant_id,
          quantity,
          name: product_name,
          price: product_price,
        } = item;
        if (!variant_id || !quantity || !product_name || !product_price)
          continue;

        await db.query(
          `
            INSERT INTO order_items (order_id, variant_id, quantity, product_name, product_price, current_status, created_at)
            VALUES (?, ?, ?, ?, ?, 'NORMAL', NOW())
          `,
          [orderId, variant_id, quantity, product_name, product_price]
        );

        await db.query(
          `UPDATE variant_product SET variant_product_quantity = variant_product_quantity - ? WHERE variant_id = ?`,
          [quantity, variant_id]
        );
        await db.query(
          `UPDATE product
          JOIN variant_product ON variant_product.product_id = product.product_id
          SET product.product_sold = product.product_sold + ?
          WHERE variant_product.variant_id = ?`,
          [quantity, variant_id]
        );
      }

      await db.query(
        `
          INSERT INTO payments (order_id, method, amount, status, created_at)
          VALUES (?, ?, ?, 'PENDING', NOW())
        `,
        [orderId, method, amount]
      );

      await db.query(
        `
          INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at)
          VALUES (?, NULL, 'PENDING', 'system', 'Khởi tạo đơn', NOW())
        `,
        [orderId]
      );

      // Sau khi insert order_status_log → Gửi thông báo cho admin
      // Lấy type_id từ bảng notification_types
      const [typeRows] = await db.query(
        `SELECT id FROM notification_types WHERE type_code = 'order' AND is_active = 1`
      );

      if (typeRows.length > 0) {
        const notificationTypeId = typeRows[0].id;

        await db.query(
          `INSERT INTO notifications (type_id, title, message, link, target, created_by, created_at)
     VALUES (?, ?, ?, ?, 'admin', 'system', NOW())`,
          [
            notificationTypeId,
            "Đơn hàng mới từ khách hàng",
            `Khách hàng ${orderNameNew || defaultName
            } vừa đặt đơn hàng COD mới (${orderHash})`,
            `/admin/orders/${orderHash}`,
          ]
        );
      } else {
      }

      if ((couponcode_id || coupon_code) && user_id) {
        let couponcodeId = couponcode_id || null;
        let coupon = null;

        if (!couponcodeId && coupon_code) {
          const [[result]] = await db.query(
            `SELECT * FROM couponcode WHERE code = ?`,
            [coupon_code]
          );
          if (result) {
            couponcodeId = result.couponcode_id;
            coupon = result;
          }
        }

        if (couponcodeId && !coupon) {
          const [[result2]] = await db.query(
            `SELECT * FROM couponcode WHERE couponcode_id = ?`,
            [couponcodeId]
          );
          coupon = result2;
        }

        // Nếu tìm thấy coupon và còn lượt
        if (coupon && coupon.used > 0) {
          // Trừ lượt sử dụng
          await db.query(
            "UPDATE couponcode SET used = used - 1 WHERE couponcode_id = ? AND used > 0",
            [coupon.couponcode_id]
          );

          // Ghi nhận vào user_has_coupon
          await db.query(
            `
      INSERT INTO user_has_coupon (user_id, couponcode_id, status)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE status = 1
    `,
            [user_id, coupon.couponcode_id]
          );
        }
      }

      // Gửi email xác nhận
      const emailData = {
        name: orderNameNew || defaultName,
        email: orderEmailNew || defaultEmail,
        phone: finalNumber2 || defaultPhone,
        address: finalAddressNew || defaultAddress,
        amount,
        method,
        order_id,
        order_hash,
        created_at: new Date().toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        }),
        current_status: "PENDING",
        order_total_final: amount.toLocaleString("vi-VN") + "đ",
        order_discount: order_discount
          ? Number(order_discount).toLocaleString("vi-VN") + "đ"
          : null,
        products: cart_items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: (item.price * 1).toLocaleString("vi-VN") + "đ",
          total: (item.price * item.quantity).toLocaleString("vi-VN") + "đ",
          image: item.image,
        })),
      };

      try {
        await sendEmail1(emailData.email, "Xác nhận đơn hàng", emailData);
      } catch (err) {
      }

      return res.status(201).json({
        message: "Đơn hàng COD đã được tạo",
        redirect: `/dat-hang-thanh-cong/${order_id}`,
        order_hash: order_id,
        order_id: orderId,
      });
    }

    // MoMo: không lưu đơn → trả về payUrl
    if (method === "MOMO") {
      for (const item of cart_items) {
        const [[variant]] = await db.query(
          `SELECT variant_product_quantity FROM variant_product WHERE variant_id = ?`,
          [item.variant_id]
        );
        if (variant.variant_product_quantity < item.quantity) {
          return res.status(400).json({
            error: `Sản phẩm ${item.name} không đủ số lượng để đặt hàng`,
          });
        }
      }

      const partnerCode = "MOMO";
      const accessKey = "F8BBA842ECF85";
      const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
      const requestType = "captureWallet";
      const orderId = req.body.order_id || `SNA-${Date.now()}`;
      const requestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const redirectUrl = `https://0f11c73646e6.ngrok-free.app/api/orders/redirect/momo`;
      const ipnUrl = `https://0f11c73646e6.ngrok-free.app/api/orders/payment/momo`;
      const orderInfo = "Thanh toán đơn hàng";

      const extraData = Buffer.from(
        JSON.stringify({
          order_id: orderId,
          user_id,
          order_total,
          order_total_final,
          order_address_new,
          order_number2,
          order_name_new,
          order_email_new,
          couponcode_id,
          cart_items,
          coupon_code,
          shipping_fee,
          order_discount,
        })
      ).toString("base64");

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      const signature = crypto
        .createHmac("sha256", secretKey)
        .update(rawSignature)
        .digest("hex");

      const momoBody = {
        partnerCode,
        accessKey,
        requestId,
        amount: amount.toString(),
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: "vi",
      };

      const momoRes = await axios.post(
        "https://test-payment.momo.vn/v2/gateway/api/create",
        momoBody,
        { headers: { "Content-Type": "application/json" } }
      );

      return res.json({ payUrl: momoRes.data.payUrl });
    }

    // VNPay: không lưu đơn → trả về payUrl
    if (method === "VNPAY") {
      const transactionCode = `VNP${Date.now()}${Math.floor(
        Math.random() * 1000
      )}`;
      const vnpay = new VNPay({
        tmnCode: "DHF21S3V",
        secureSecret: "NXM2DJWRF8RLC4R5VBK85OJZS1UE9KI6F",
        vnpayHost: "https://sandbox.vnpayment.vn",
        testMode: true,
        hashAlgorithm: "SHA512",
        loggerFn: () => { },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: amount * 100,
        vnp_IpAddr: "127.0.0.1",
        vnp_TxnRef: transactionCode,
        vnp_OrderInfo: `Thanh toán đơn hàng #${order_id}`,
        vnp_OrderType: "other",
        vnp_ReturnUrl: `${process.env.VITE_API_BASE_URL}/orders/payment/vnpay`,
        vnp_Locale: "vn",
        vnp_CreateDate: formatDateVNPay(new Date()),
        vnp_ExpireDate: formatDateVNPay(tomorrow),
      });

      return res.status(200).json({
        message: "Tạo thanh toán VNPAY",
        payUrl: paymentUrl,
        redirect: "/",
      });
    }

    return res
      .status(400)
      .json({ error: "Phương thức thanh toán không hỗ trợ" });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server khi tạo đơn hàng" });
  }
});

router.post("/payment/momo", async (req, res) => {
  const {
    orderId,
    amount,
    resultCode,
    requestId,
    orderInfo,
    orderType,
    transId,
    payType,
    extraData,
    signature,
    message,
    partnerCode,
    responseTime,
  } = req.body;

  const accessKey = "F8BBA842ECF85";
  const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

  try {
    // Kiểm tra chữ ký hợp lệ
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    // Kiểm tra chữ ký
    if (!signature || !rawSignature) {
      return res.status(400).json({ message: "Thiếu thông tin chữ ký" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    if (!signature || expectedSignature !== signature) {
      return res.status(403).json({ error: "Sai chữ ký MoMo" });
    }
    if (parseInt(resultCode) !== 0) {
      return res
        .status(400)
        .json({ error: "Thanh toán MoMo không thành công" });
    }

    // Kiểm tra đơn đã tồn tại chưa
    const [existingOrder] = await db.query(
      "SELECT * FROM orders WHERE order_hash = ?",
      [orderId]
    );
    if (existingOrder.length > 0) {
      const existingOrderId = existingOrder[0].order_id;
      const [existingPayment] = await db.query(
        "SELECT * FROM payments WHERE order_id = ? AND method = 'MOMO'",
        [existingOrderId]
      );

      if (existingPayment.length === 0) {
        await db.query(
          "INSERT INTO payments (order_id, method, amount, status, transaction_code, created_at) VALUES (?, 'MOMO', ?, 'PAID', ?, NOW())",
          [existingOrderId, amount, transId]
        );
        await db.query(
          "INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) VALUES (?, NULL, 'PAID', 'system', 'Xác nhận lại MoMo', NOW())",
          [existingOrderId]
        );
      }

      return res
        .status(200)
        .json({ message: "Đơn hàng đã tồn tại và đã xử lý thanh toán." });
    }

    // Giải mã extraData
    const extra = JSON.parse(Buffer.from(extraData, "base64").toString("utf8"));
    const {
      user_id,
      order_total,
      order_total_final,
      cart_items = [],
      order_name_new,
      order_email_new,
      order_address_new,
      order_number2,
      couponcode_id,
      coupon_code,
      shipping_fee,
      order_discount,
    } = extra;

    const order_hash = orderId;
    // Lấy thông tin user mặc định
    const [[userInfo]] = await db.query(
      `SELECT user_address, user_number, user_name, user_gmail FROM user WHERE user_id = ?`,
      [user_id]
    );
    const defaultName = userInfo.user_name?.trim() || "";
    const defaultEmail = userInfo.user_gmail?.trim() || "";
    const defaultAddress = userInfo.user_address?.trim() || "";
    const defaultPhone = userInfo.user_number?.trim() || "";

    const finalName =
      order_name_new?.trim() && order_name_new.trim() !== defaultName
        ? order_name_new.trim()
        : null;
    const finalEmail =
      order_email_new?.trim() && order_email_new.trim() !== defaultEmail
        ? order_email_new.trim()
        : null;
    const finalAddress =
      order_address_new?.trim() && order_address_new.trim() !== defaultAddress
        ? order_address_new.trim()
        : null;
    const finalPhone =
      order_number2?.trim() && order_number2.trim() !== defaultPhone
        ? order_number2.trim()
        : null;

    let couponcodeId = couponcode_id || null;
    if (!couponcodeId && coupon_code) {
      const [[coupon]] = await db.query(
        "SELECT couponcode_id FROM couponcode WHERE code = ?",
        [coupon_code]
      );
      if (coupon) couponcodeId = coupon.couponcode_id;
    }

    await db.query(
      `
      INSERT INTO orders (
        order_hash, user_id, order_address_old, order_address_new,
        order_number1, order_number2, order_total, order_total_final,
        shipping_fee, order_discount,
        current_status, created_at,
        order_name_old, order_name_new,
        order_email_old, order_email_new,
        couponcode_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
    `,
      [
        order_hash,
        user_id,
        defaultAddress,
        finalAddress,
        defaultPhone,
        finalPhone,
        order_total,
        order_total_final,
        shipping_fee,
        order_discount,
        "PENDING",
        defaultName,
        finalName,
        defaultEmail,
        finalEmail,
        couponcodeId,
      ]
    );

    const [[orderRow]] = await db.query(
      "SELECT order_id, order_hash FROM orders WHERE order_hash = ?",
      [order_hash]
    );
    const order_id = orderRow.order_id;
    const orderHash = orderRow.order_hash;

    for (const item of cart_items) {
      const {
        variant_id,
        quantity,
        name: product_name,
        price: product_price,
      } = item;
      if (!variant_id || !quantity || !product_name || !product_price) continue;

      const [updateResult] = await db.query(
        "UPDATE variant_product SET variant_product_quantity = variant_product_quantity - ? WHERE variant_id = ? AND variant_product_quantity >= ?",
        [quantity, variant_id, quantity]
      );

      if (updateResult.affectedRows === 0) {
        const failedItem = {
          name: product_name,
          quantity,
          price: product_price,
          image: item.image || null,
        };
        await db.query(
          "INSERT INTO order_items (order_id, variant_id, quantity, product_name, product_price, current_status, created_at) VALUES (?, ?, ?, ?, ?, 'FAILED', NOW())",
          [order_id, variant_id, quantity, product_name, product_price]
        );

        await db.query(
          "INSERT INTO payments (order_id, method, amount, status, transaction_code, created_at) VALUES (?, 'MOMO', ?, 'SUCCESS', ?, NOW())",
          [order_id, amount, transId]
        );
        await db.query(
          "UPDATE orders SET current_status = 'FAILED' WHERE order_id = ?",
          [order_id]
        );
        await db.query(
          "INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) VALUES (?, 'PENDING', 'FAILED', 'system', 'Thiếu hàng khi thanh toán MoMo', NOW())",
          [order_id]
        );

        await sendEmail1(
          finalEmail || defaultEmail,
          "Thanh toán thất bại do sản phẩm hết hàng",
          {
            name: finalName || defaultName,
            email: finalEmail || defaultEmail,
            phone: finalPhone || defaultPhone,
            address: finalAddress || defaultAddress,
            amount,
            method: "MOMO",
            order_id,
            order_hash,
            created_at: new Date().toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
            }),
            current_status: "THẤT BẠI",
            order_total_final: amount.toLocaleString("vi-VN") + "đ",
            order_discount:
              order_discount > 0
                ? Number(order_discount).toLocaleString("vi-VN") + "đ"
                : null,
            products: cart_items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: (item.price * 1).toLocaleString("vi-VN") + "đ",
              total: (item.price * item.quantity).toLocaleString("vi-VN") + "đ",
              image: item.image,
            })),
            message: `Sản phẩm "${failedItem.name}" đã hết hàng khi thanh toán. Hệ thống sẽ hoàn tiền tự động.`,
          },
          "order-failed"
        );

        try {
          const refundData = {
            partnerCode,
            accessKey,
            requestId: Date.now().toString(),
            amount: amount.toString(),
            orderId: orderId + "_refund",
            transId,
            lang: "vi",
            description: "Hoàn tiền do sản phẩm đã hết hàng",
          };

          const rawRefundSignature = `accessKey=${refundData.accessKey}&amount=${refundData.amount}&description=${refundData.description}&orderId=${refundData.orderId}&partnerCode=${refundData.partnerCode}&requestId=${refundData.requestId}&transId=${refundData.transId}`;

          refundData.signature = crypto
            .createHmac("sha256", secretKey)
            .update(rawRefundSignature)
            .digest("hex");

          try {
            const refundRes = await axios.post(
              "https://test-payment.momo.vn/v2/gateway/api/refund",
              refundData,
              {
                headers: { "Content-Type": "application/json" },
              }
            );
            if (refundRes.data.resultCode === 0) {
              await db.query(
                "UPDATE payments SET status = 'REFUNDED' WHERE order_id = ?",
                [order_id]
              );
              await db.query(
                "INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) VALUES (?, 'FAILED', 'REFUNDED', 'system', 'Đã hoàn tiền qua MoMo', NOW())",
                [order_id]
              );
            } else {
            }
          } catch (error) {
          }
        } catch (refundErr) {
        }

        return res.status(200).json({
          success: false,
          resultCode: 1,
          message: `Sản phẩm '${failedItem.name}' không còn đủ hàng. Đã ghi nhận hoàn tiền.`,
        });
      }

      await db.query(
        "INSERT INTO order_items (order_id, variant_id, quantity, product_name, product_price, current_status, created_at) VALUES (?, ?, ?, ?, ?, 'NORMAL', NOW())",
        [order_id, variant_id, quantity, product_name, product_price]
      );
      await db.query(
        "UPDATE product JOIN variant_product ON variant_product.product_id = product.product_id SET product.product_sold = product.product_sold + ? WHERE variant_product.variant_id = ?",
        [quantity, variant_id]
      );
    }

    const wishlistIdsToDelete = [];

    for (const item of cart_items) {
      const [wishlistRows] = await db.query(
        "SELECT wishlist_id FROM wishlist WHERE user_id = ? AND variant_id = ?",
        [user_id, item.variant_id]
      );
      wishlistRows.forEach((row) => wishlistIdsToDelete.push(row.wishlist_id));
    }

    if (wishlistIdsToDelete.length > 0) {
      await db.query("DELETE FROM wishlist WHERE wishlist_id IN (?)", [
        wishlistIdsToDelete,
      ]);
    }

    await db.query(
      "INSERT INTO payments (order_id, method, amount, status, transaction_code, created_at) VALUES (?, 'MOMO', ?, 'SUCCESS', ?, NOW())",
      [order_id, amount, transId]
    );
    await db.query(
      "INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) VALUES (?, NULL, 'PAID', 'system', 'Khởi tạo đơn', NOW())",
      [order_id]
    );

    const [typeRows] = await db.query(
      `SELECT id FROM notification_types WHERE type_code = 'order' AND is_active = 1`
    );

    if (typeRows.length > 0) {
      const notificationTypeId = typeRows[0].id;

      await db.query(
        `INSERT INTO notifications (type_id, title, message, link, target, created_by, created_at)
     VALUES (?, ?, ?, ?, 'admin', 'system', NOW())`,
        [
          notificationTypeId,
          "Đơn hàng mới từ khách hàng",
          `Khách hàng ${finalName || defaultName
          } vừa đặt đơn hàng MOMO mới (${orderHash})`,
          `/admin/orders/${orderHash}`,
        ]
      );
    } else {
    }

    if ((couponcode_id || coupon_code) && user_id) {
      let coupon = null;
      if (!couponcodeId && coupon_code) {
        const [[result]] = await db.query(
          "SELECT * FROM couponcode WHERE code = ?",
          [coupon_code]
        );

        if (result) {
          couponcodeId = result.couponcode_id;
          coupon = result;
        }
      }
      if (couponcodeId && !coupon) {
        // Gửi email xác nhận
        const [[result2]] = await db.query(
          "SELECT * FROM couponcode WHERE couponcode_id = ?",
          [couponcodeId]
        );
        coupon = result2;
      }
      if (coupon && coupon.used > 0) {
        await db.query(
          "UPDATE couponcode SET used = used - 1 WHERE couponcode_id = ? AND used > 0",
          [coupon.couponcode_id]
        );
        await db.query(
          "INSERT INTO user_has_coupon (user_id, couponcode_id, status) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE status = 1",
          [user_id, coupon.couponcode_id]
        );
      }
    }

    const emailData = {
      name: finalName || defaultName,
      email: finalEmail || defaultEmail,
      phone: finalPhone || defaultPhone,
      address: finalAddress || defaultAddress,
      amount,
      method: "MOMO",
      order_id,
      order_hash,
      created_at: new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      current_status: "PENDING",
      order_total_final: amount.toLocaleString("vi-VN") + "đ",
      order_discount: order_discount
        ? Number(order_discount).toLocaleString("vi-VN") + "đ"
        : null,
      products: cart_items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: (item.price * item.quantity).toLocaleString("vi-VN") + "đ",
        image: item.image,
      })),
    };

    try {
      await sendEmail1(emailData.email, "Xác nhận đơn hàng", emailData);
    } catch (err) {
    }

    return res.status(200).json({
      success: true,
      resultCode: 0,
      message: "Đơn hàng đã thanh toán thành công qua MoMo",
    });
  } catch (error) {
    return res.status(500).json({ error: "Lỗi server khi xử lý IPN MoMo" });
  }
});

router.get("/redirect/momo", (req, res) => {
  const { resultCode, orderId } = req.query;

  if (parseInt(resultCode) === 0) {
    return res.redirect(
      `${process.env.SITE_URL}/dat-hang-thanh-cong/${orderId}`
    );
  }

  return res.redirect(`${process.env.SITE_URL}/`);
});

/**
 * @route   GET /api/orders/:id
 * @desc    Lấy thông tin chi tiết một đơn hàng
 * @access  Private
 */

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const orderQuery = `
      SELECT 
        o.*,
        u.user_gmail AS user_email,
        u.user_name AS user_name,
        u.user_number AS user_phone,
        p.method AS payment_method,
        p.status AS payment_status,
        p.transaction_code AS payment_transaction_code,
        p.paid_at AS payment_paid_at
      FROM \`orders\` o
      LEFT JOIN user u ON o.user_id = u.user_id
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE o.order_id = ?
    `;

    let orders;
    try {
      [orders] = await db.query(orderQuery, [orderId]);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to fetch order", details: error.message });
    }

    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    let order = orders[0];

    // Gộp thông tin thanh toán vào array `payment[]`, rồi xoá các field gốc
    order.payment = [
      {
        method: order.payment_method,
        status: order.payment_status,
        transaction_code: order.payment_transaction_code,
        paid_at: order.payment_paid_at,
      },
    ];
    delete order.payment_method;
    delete order.payment_status;
    delete order.payment_transaction_code;
    delete order.payment_paid_at;

    // Kiểm tra quyền truy cập
    if (req.user.role !== "admin" && req.user.id !== order.user_id) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view this order" });
    }

    try {
      // Lấy chi tiết sản phẩm
      const orderItemsQuery = `
        SELECT 
          oi.*,
          p.product_name,
          p.product_image,
          p.product_slug,
          vp.variant_product_price,
          vp.variant_product_price_sale,
          vp.variant_product_list_image,
          vp.color_id as variant_color_id,
          c.color_name,
          c.color_hex,
          cat.category_name AS category,
          (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) AS comment_count,
          (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) AS average_rating
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        LEFT JOIN color c ON vp.color_id = c.color_id
        LEFT JOIN category cat ON p.category_id = cat.category_id
        WHERE oi.order_id = ?
      `;

      let orderItems;
      try {
        [orderItems] = await db.query(orderItemsQuery, [orderId]);

        // Additional debug: Check variant_product table directly
        if (orderItems.length > 0) {
          const variantId = orderItems[0].variant_id;
          const [[variantInfo]] = await db.query(
            `SELECT variant_id, color_id FROM variant_product WHERE variant_id = ?`,
            [variantId]
          );
          if (variantInfo && variantInfo.color_id) {
            const [[colorInfo]] = await db.query(
              `SELECT color_id, color_name, color_hex FROM color WHERE color_id = ?`,
              [variantInfo.color_id]
            );
          }
        }
        order.items = orderItems;
      } catch (error) {
        order.items = [];
      }

      // Lấy trạng thái đơn hàng
      const statusLogsQuery = `
        SELECT 
          osl.*
        FROM order_status_log osl
        WHERE osl.order_id = ?
        ORDER BY osl.created_at ASC
      `;

      let statusLogs;
      try {
        [statusLogs] = await db.query(statusLogsQuery, [orderId]);
        order.status_logs = statusLogs;
      } catch (error) {
        order.status_logs = [];
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch order details",
        details: error.message,
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch order", details: error.message });
  }
});

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Cập nhật trạng thái đơn hàng
 * @access  Private (Admin)
 */
router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  const orderId = req.params.id;
  const { new_status } = req.body;

  const validStatuses = [
    "PENDING",
    "CONFIRMED",
    "SHIPPING",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
  ];

  if (!validStatuses.includes(new_status)) {
    return res
      .status(400)
      .json({ success: false, message: "Trạng thái không hợp lệ" });
  }

  try {
    // Lấy trạng thái hiện tại của đơn + user_id + order_hash
    const [[order]] = await db.query(
      "SELECT current_status, user_id, order_hash FROM orders WHERE order_id = ?",
      [orderId]
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const fromStatus = order.current_status;
    const toStatus = new_status;

    if (fromStatus === toStatus) {
      return res.status(200).json({
        success: true,
        message: "Trạng thái không thay đổi",
      });
    }

    // Cập nhật trạng thái đơn hàng
    await db.query("UPDATE orders SET current_status = ? WHERE order_id = ?", [
      toStatus,
      orderId,
    ]);






    // Ghi log chuyển trạng thái
    await db.query(
      `INSERT INTO order_status_log (
        order_id, from_status, to_status, trigger_by, step, created_at
      ) VALUES (?, ?, ?, 'admin', ?, NOW())`,
      [
        orderId,
        fromStatus,
        toStatus,
        `Chuyển trạng thái từ ${fromStatus} ➝ ${toStatus}`,
      ]
    );

    // Gửi thông báo cho user
    const userId = order.user_id;
    const orderHash = order.order_hash;

    if (userId) {
      // Lấy loại thông báo 'order'
      const [typeRows] = await db.query(
        `SELECT id FROM notification_types WHERE type_code = 'order' AND is_active = 1`
      );

      if (typeRows.length > 0) {
        const notificationTypeId = typeRows[0].id;

        // Map trạng thái sang tiếng Việt
        const statusMessageMap = {
          PENDING: "Chờ xác nhận",
          CONFIRMED: "Đã xác nhận",
          SHIPPING: "Đang giao hàng",
          SUCCESS: "Giao hàng thành công",
          FAILED: "Giao hàng thất bại",
          CANCELLED: "Đã hủy đơn",
        };

        const readableStatus = statusMessageMap[toStatus] || toStatus;
        const notificationTitle = "Cập nhật trạng thái đơn hàng";
        const notificationMessage = `Đơn hàng ${orderHash} của bạn đã được chuyển sang trạng thái "${readableStatus}".`;
        const orderLink = `chi-tiet-don-hang/${orderHash}`;
        // Ghi vào bảng notifications
        const [notiResult] = await db.query(
          `INSERT INTO notifications (type_id, title, message, link, created_by)
          VALUES (?, ?, ?, ?, ?)`,
          [
            notificationTypeId,
            notificationTitle,
            notificationMessage,
            orderLink,
            "admin",
          ]
        );

        const notificationId = notiResult.insertId;

        // Ghi vào bảng user_notifications
        await db.query(
          `INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
           VALUES (?, ?, 0, NULL, 0)`,
          [userId, notificationId]
        );
      } else {
      }
    }

    return res.status(200).json({
      success: true,
      message: `Đã chuyển trạng thái đơn hàng sang ${toStatus}`,
      new_status: toStatus,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật trạng thái",
    });
  }
});

/**
 * @route   PUT /api/orders/:id/return-status
 * @desc    Cập nhật trạng thái hoàn trả đơn hàng
 * @access  Private (Admin)
 */
router.put("/:id/return-status", verifyToken, isAdmin, async (req, res) => {
  const orderId = req.params.id;
  const { return_status } = req.body;

  const validReturnStatuses = [
    "",
    "PENDING",
    "APPROVED",
    "CANCEL_CONFIRMED",
    "CANCELLED",
    "REJECTED",
  ];

  if (!validReturnStatuses.includes(return_status)) {
    return res.status(400).json({
      success: false,
      message: "Trạng thái hoàn trả không hợp lệ",
    });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [[order]] = await connection.query(
      "SELECT order_id, order_hash, current_status FROM orders WHERE order_id = ?",
      [orderId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    if (order.current_status !== "RETURN" && return_status !== "") {
      return res.status(400).json({
        success: false,
        message:
          "Chỉ có thể thay đổi trạng thái hoàn trả khi đơn hàng đang ở trạng thái RETURN",
      });
    }

    if (return_status === "") {
      await connection.query("DELETE FROM order_returns WHERE order_id = ?", [
        orderId,
      ]);
      await connection.query(
        "UPDATE orders SET current_status = 'SUCCESS' WHERE order_id = ?",
        [orderId]
      );
      await connection.query(
        `INSERT INTO order_status_log (
          order_id, from_status, to_status, trigger_by, step, created_at
        ) VALUES (?, 'RETURN', 'SUCCESS', 'admin', ?, NOW())`,
        [orderId, "Hủy yêu cầu hoàn trả"]
      );
    } else {
      const [[existingReturn]] = await connection.query(
        "SELECT return_id, status FROM order_returns WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
        [orderId]
      );

      if (existingReturn) {
        await connection.query(
          "UPDATE order_returns SET status = ?, updated_at = NOW() WHERE return_id = ?",
          [return_status, existingReturn.return_id]
        );
      } else {
        await connection.query(
          `INSERT INTO order_returns (
            order_id, user_id, reason, return_type, total_refund, status, created_at
          ) VALUES (?, ?, ?, 'REFUND', 0, ?, NOW())`,
          [orderId, req.user.id, "Được tạo bởi admin", return_status]
        );
      }

      await connection.query(
        `INSERT INTO order_status_log (
          order_id, from_status, to_status, trigger_by, step, created_at
        ) VALUES (?, ?, ?, 'admin', ?, NOW())`,
        [
          orderId,
          existingReturn ? existingReturn.status : "NEW",
          return_status,
          `Cập nhật trạng thái hoàn trả: ${return_status}`,
        ]
      );
    }

    // ✅ Nếu đơn hàng được duyệt hoàn trả (APPROVED)
    if (return_status === "APPROVED") {
      // Lấy thông tin khách hàng & hoàn trả
      const [[customerInfo]] = await connection.query(
        `SELECT o.order_hash, o.order_name_new, o.order_email_new, 
                u.user_id, u.user_name, u.user_gmail as user_email,
                or_data.reason, or_data.total_refund
         FROM orders o
         LEFT JOIN user u ON o.user_id = u.user_id
         LEFT JOIN order_returns or_data ON o.order_id = or_data.order_id
         WHERE o.order_id = ?
         ORDER BY or_data.created_at DESC
         LIMIT 1`,
        [orderId]
      );

      const customerEmail =
        customerInfo.order_email_new || customerInfo.user_email;
      const customerName =
        customerInfo.order_name_new || customerInfo.user_name;
      const userId = customerInfo.user_id;

      if (!userId || !customerEmail) {
        throw new Error("Không có đủ thông tin khách hàng để xử lý tiếp");
      }

      // Gửi email thông báo duyệt trả hàng
      const emailData = {
        customerName: customerName || "Khách hàng",
        orderHash: customerInfo.order_hash,
        reason: customerInfo.reason || "Yêu cầu trả hàng",
        refundAmount: customerInfo.total_refund || 0,
        approvalDate: new Date().toLocaleDateString("vi-VN"),
        supportEmail: "sonaspace.furniture@gmail.com",
        supportPhone: "1900-xxxx",
      };

      await sendEmail1(
        customerEmail,
        `[Sona Space] Đã duyệt yêu cầu trả hàng - ${customerInfo.order_hash}`,
        emailData,
        "return-approved"
      );

      // Tạo mã giảm giá 20%
      const timestamp = Date.now().toString().slice(-6);
      const userIdStr = userId.toString().padStart(3, "0");
      const couponCode = `RETURN20_${userIdStr}_${timestamp}`;

      const startDate = new Date();
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 14);

      const [couponResult] = await connection.query(
        `
        INSERT INTO couponcode (
          code, title, value_price, description, start_time, exp_time,
          min_order, used, is_flash_sale, combinations, discount_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          couponCode,
          "Mã giảm giá trả hàng",
          20,
          "Mã giảm giá 20% dành cho khách hàng trả hàng thành công. Áp dụng cho đơn hàng tiếp theo.",
          startDate,
          expDate,
          100000,
          1,
          0,
          null,
          "percentage",
          1,
        ]
      );

      const couponId = couponResult.insertId;

      await connection.query(
        `INSERT INTO user_has_coupon (user_id, couponcode_id, status) VALUES (?, ?, 0)`,
        [userId, couponId]
      );

      // Gửi thông báo
      const [typeRows] = await connection.query(
        `SELECT id FROM notification_types WHERE type_code = ? AND is_active = 1`,
        ["coupon"]
      );

      if (typeRows.length > 0) {
        const notificationTypeId = typeRows[0].id;
        const notificationTitle = "🎁 Bạn nhận được mã giảm giá trả hàng!";
        const notificationMessage = `Cảm ơn bạn đã tin tưởng Sona Space! Mã ${couponCode} giảm 20% đã được thêm vào tài khoản. Áp dụng cho đơn hàng từ 100,000đ. Hạn sử dụng: ${expDate.toLocaleDateString("vi-VN")}`;

        const [notiResult] = await connection.query(
          `INSERT INTO notifications (type_id, title, message, created_by) VALUES (?, ?, ?, ?)`,
          [notificationTypeId, notificationTitle, notificationMessage, "system"]
        );

        const notificationId = notiResult.insertId;

        await connection.query(
          `INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
           VALUES (?, ?, 0, NULL, 0)`,
          [userId, notificationId]
        );
      }

      // Cập nhật lại product_sold
        const [orderItems] = await connection.query(
        `SELECT oi.variant_id, oi.quantity, vp.product_id 
         FROM order_items oi
         LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
         WHERE oi.order_id = ?`,
        [orderId]
      );

          if (customerInfo) {
            const customerEmail =
              customerInfo.order_email_new || customerInfo.user_email;
            const customerName =
              customerInfo.order_name_new || customerInfo.user_name;

            if (customerEmail) {
              try {
                const emailData = {
                  customerName: customerName || "Khách hàng",
                  orderId: orderId,
                  orderHash: customerInfo.order_hash,
                  orderTotal: new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(customerInfo.order_total_final || 0),
                  returnDate: new Date(
                    customerInfo.return_date
                  ).toLocaleDateString("vi-VN"),
                  rejectReason:
                    customerInfo.reason ||
                    "Sản phẩm không đáp ứng điều kiện trả hàng theo chính sách của công ty.",
                };

                const emailResult = await sendEmail1(
                  customerEmail,
                  `[Sona Space] Thông báo từ chối yêu cầu trả hàng - ${customerInfo.order_hash}`,
                  emailData,
                  "return-rejected"
                );

                console.log(
                  `📧 Rejection email sent to ${customerEmail}:`,
                  emailResult ? "Success" : "Failed"
                );
              } catch (emailError) {
                console.error(
                  "❌ Failed to send return rejection email:",
                  emailError.message
                );
                // Continue execution even if email fails
              }
            }
          }
        }

      const statusText =
      return_status === ""
        ? "Không có hoàn trả"
        : return_status === "PENDING"
          ? "Đang chờ xử lý"
          : return_status === "APPROVED"
            ? "Đã duyệt trả hàng"
            : return_status === "CANCEL_CONFIRMED"
              ? "Xác nhận hủy đơn hàng"
              : return_status === "CANCELLED"
                ? "Đã hủy hoàn tất"
                : return_status === "REJECTED"
                  ? "Từ chối trả hàng"
                  : return_status;

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái hoàn trả thành: ${statusText}`,
      return_status,
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Lỗi cập nhật trạng thái hoàn trả:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật trạng thái hoàn trả",
    });
  } finally {
    connection.release();
  }
});


/**
 * @route   DELETE /api/orders/:id
 * @desc    Hủy đơn hàng (chỉ admin hoặc chủ đơn hàng mới tạo)
 * @access  Private
 */
router.delete("/:id", async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    // Kiểm tra đơn hàng tồn tại
    const [existingOrder] = await db.query(
      `
      SELECT order_id, user_id, current_status, created_at 
      FROM \`orders\` WHERE order_id = ?
    `,
      [orderId]
    );

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = existingOrder[0];

    // Kiểm tra quyền hủy đơn hàng
    if (req.user.role !== "admin" && req.user.id !== order.user_id) {
      return res
        .status(403)
        .json({ error: "You do not have permission to cancel this order" });
    }

    // Chỉ cho phép hủy đơn hàng ở trạng thái PENDING hoặc CONFIRMED
    if (
      order.current_status !== "PENDING" &&
      order.current_status !== "CONFIRMED" &&
      req.user.role !== "admin"
    ) {
      return res
        .status(400)
        .json({ error: "Cannot cancel order in current status" });
    }

    // Chỉ khách hàng mới được hủy đơn hàng trong vòng 24 giờ sau khi tạo
    if (req.user.role !== "admin") {
      const orderDate = new Date(order.created_at);
      const currentDate = new Date();
      const hoursDiff = (currentDate - orderDate) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return res
          .status(400)
          .json({ error: "Cannot cancel order after 24 hours" });
      }
    }

    // Bắt đầu transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Lấy danh sách sản phẩm trong đơn hàng
      const [orderItems] = await connection.query(
        "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?",
        [orderId]
      );

      // Khôi phục số lượng tồn kho
      for (const item of orderItems) {
        if (item.variant_id) {
          await connection.query(
            "UPDATE variant_product SET stock = stock + ? WHERE variant_id = ?",
            [item.quantity, item.variant_id]
          );
        } else {
          await connection.query(
            "UPDATE product SET stock = stock + ? WHERE product_id = ?",
            [item.quantity, item.product_id]
          );
        }
      }

      // Cập nhật trạng thái đơn hàng sang "Đã hủy"
      await connection.query(
        'UPDATE `orders` SET current_status = "CANCELLED", updated_at = NOW() WHERE order_id = ?',
        [orderId]
      );

      // Thêm vào lịch sử trạng thái
      await connection.query(
        `
        INSERT INTO order_status_log (
          order_id, from_status, to_status, trigger_by, step, created_at
        ) VALUES (?, ?, 'CANCELLED', ?, ?, NOW())
      `,
        [
          orderId,
          order.current_status,
          req.user.role === "admin" ? "admin" : "customer",
          "Đơn hàng đã bị hủy",
        ]
      );

      // Commit transaction
      await connection.commit();

      res.json({ message: "Order cancelled successfully" });
    } catch (error) {
      // Rollback nếu có lỗi
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

/**
 * @route   GET /api/orders/status/count
 * @desc    Lấy số lượng đơn hàng theo trạng thái (chỉ admin)
 * @access  Private (Admin)
 */
router.get("/status/count", isAdmin, async (req, res) => {
  try {
    const [result] = await db.query(`
      SELECT current_status, COUNT(*) as count
      FROM \`orders\`
      GROUP BY current_status
    `);

    // Lấy danh sách các trạng thái có thể có
    const statuses = [
      { status: "PENDING", name: "Chờ xác nhận" },
      { status: "CONFIRMED", name: "Đã xác nhận" },
      { status: "SHIPPING", name: "Đang giao" },
      { status: "SUCCESS", name: "Giao hàng thành công" },
      { status: "FAILED", name: "Thất bại" },
      { status: "CANCELLED", name: "Đã hủy" },
      { status: "RETURN", name: "Đã trả hàng" },
    ];

    // Tạo đối tượng thống kê
    const statistics = statuses.map((status) => {
      const count = result.find((r) => r.current_status === status.status);
      return {
        status: status.status,
        status_name: status.name,
        count: count ? count.count : 0,
      };
    });

    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order status counts" });
  }
});

/**
 * @route   POST /api/orders/send-invoice
 * @desc    Gửi hóa đơn qua email
 * @access  Private
 */
router.post("/send-invoice", verifyToken, async (req, res) => {
  try {
    const { order_id, email } = req.body;

    if (!order_id || !email) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin đơn hàng hoặc email",
      });
    }

    // Lấy thông tin đơn hàng
    const [orders] = await db.query(
      `
      SELECT * FROM orders WHERE order_id = ?
    `,
      [order_id]
    );

    if (orders.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const order = orders[0];

    // Lấy thông tin chi tiết đơn hàng
    const [orderItems] = await db.query(
      `
      SELECT oi.*, p.product_name, vp.variant_name
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      WHERE oi.order_id = ?
    `,
      [order_id]
    );

    // Tạo nội dung email
    const invoiceUrl = `${process.env.SITE_URL || "http://localhost:3501"
      }/dashboard/orders/invoice/${order_id}`;

    // Trong thực tế, bạn sẽ sử dụng một thư viện gửi email như nodemailer
    // Ví dụ mẫu này chỉ giả lập việc gửi email
    // Trong môi trường thực tế, bạn sẽ gửi email thực sự:
    /*
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Hóa đơn đơn hàng #${order_id} - Sona Space`,
      html: `
        <h1>Hóa đơn đơn hàng #${order_id}</h1>
        <p>Kính gửi ${order.customer_name || 'Quý khách'},</p>
        <p>Cảm ơn bạn đã mua hàng tại Sona Space. Vui lòng xem hóa đơn chi tiết tại đường dẫn bên dưới:</p>
        <p><a href="${invoiceUrl}" target="_blank">Xem hóa đơn</a></p>
        <p>Trân trọng,</p>
        <p>Đội ngũ Sona Space</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    */

    res.json({
      success: true,
      message: "Hóa đơn đã được gửi thành công",
      data: {
        order_id,
        email,
        invoice_url: invoiceUrl,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi gửi hóa đơn",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/orders/:id/send-apology-email
 * @desc    Gửi email xin lỗi cho khách hàng
 * @access  Private (Admin)
 */
router.post(
  "/:id/send-apology-email",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, message } = req.body;

      // Lấy thông tin đơn hàng và khách hàng
      const [orders] = await db.query(
        `
      SELECT o.*, u.user_name, u.user_gmail, u.user_number
      FROM orders o
      LEFT JOIN user u ON o.user_id = u.user_id
      WHERE o.order_id = ?
    `,
        [id]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      const order = orders[0];

      if (!order.user_gmail) {
        return res.status(400).json({
          success: false,
          message: "Đơn hàng không có email khách hàng",
        });
      }

      // Chuẩn bị dữ liệu email
      const voucherCode = `SORRY${order.order_id}${Date.now()
        .toString()
        .slice(-4)}`; // Tạo mã unique với order_id
      const emailData = {
        customerName: order.user_name || "Quý khách",
        orderId: order.order_id,
        orderHash: order.order_hash,
        orderTotal: new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(order.order_total_final),
        reason: reason || "Sự cố kỹ thuật",
        message:
          message ||
          "Chúng tôi xin lỗi vì sự bất tiện này và sẽ khắc phục sớm nhất có thể.",
        voucherCode: voucherCode,
        discountPercent: 20,
        expiryDate: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000
        ).toLocaleDateString("vi-VN"),
        validDays: 14,
      };

      // Gửi email xin lỗi
      const emailResult = await sendEmail1(
        order.user_gmail,
        "Xin lỗi về sự cố đơn hàng - Sona Space",
        emailData,
        "apology"
      );

      if (emailResult.success) {
        // Log hoạt động
        res.json({
          success: true,
          message: "Email xin lỗi đã được gửi thành công",
          data: {
            order_id: order.order_id,
            email: order.user_gmail,
            sent_at: new Date().toISOString(),
            voucherCode: emailData.voucherCode,
            discountPercent: emailData.discountPercent,
            expiryDate: emailData.expiryDate,
          },
        });
      } else {
        throw new Error(emailResult.error || "Không thể gửi email");
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi khi gửi email xin lỗi",
        error: error.message,
      });
    }
  }
);

/**
 * @route   PATCH /api/orders/:id
 * @desc    Update specific fields of an order
 * @access  Private (Admin)
 */
router.patch("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const updateData = req.body;

    // Validate that orderId is a number
    if (isNaN(parseInt(orderId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Check if order exists
    const [[orderExists]] = await db.query(
      "SELECT order_id FROM orders WHERE order_id = ?",
      [orderId]
    );

    if (!orderExists) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Start a transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Allowed fields to update in orders table
      const allowedOrderFields = [
        "order_name_new",
        "order_email_new",
        "order_number2",
        "order_address_new",
        "note",
      ];

      // Special case for payment_method - this goes in the payments table
      const paymentMethod = updateData.payment_method;
      delete updateData.payment_method;

      // Filter out any fields that are not allowed
      const filteredData = {};
      for (const key in updateData) {
        if (allowedOrderFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      }

      // Update the order table if there are fields to update
      if (Object.keys(filteredData).length > 0) {
        const setClause = Object.keys(filteredData)
          .map((key) => `${key} = ?`)
          .join(", ");

        const values = [...Object.values(filteredData), orderId];

        await connection.query(
          `UPDATE orders SET ${setClause}, updated_at = NOW() WHERE order_id = ?`,
          values
        );
      }

      // Update payment method if provided
      if (paymentMethod) {
        // Check if valid payment method
        const validPaymentMethods = [
          "COD",
          "BANK_TRANSFER",
          "VNPAY",
          "MOMO",
          "ZALOPAY",
        ];
        if (!validPaymentMethods.includes(paymentMethod)) {
          throw new Error("Invalid payment method");
        }

        // Check if payment record exists
        const [[paymentExists]] = await connection.query(
          "SELECT payment_id FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
          [orderId]
        );

        if (paymentExists) {
          // Update existing payment record
          await connection.query(
            "UPDATE payments SET method = ?, updated_at = NOW() WHERE payment_id = ?",
            [paymentMethod, paymentExists.payment_id]
          );
        } else {
          // Create new payment record
          await connection.query(
            "INSERT INTO payments (order_id, method, amount, status, created_at) VALUES (?, ?, 0, 'PENDING', NOW())",
            [orderId, paymentMethod]
          );
        }

        // Add payment_method to the list of updated fields
        filteredData.payment_method = paymentMethod;
      }

      // Commit the transaction
      await connection.commit();

      return res.status(200).json({
        success: true,
        message: "Order updated successfully",
        updatedFields: Object.keys(filteredData),
      });
    } catch (error) {
      // Rollback the transaction on error
      await connection.rollback();
      throw error;
    } finally {
      // Release the connection
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while updating order",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/orders/return/:orderHash
 * @desc    Process an order return request with images
 * @access  Private
 */
router.post(
  "/return/:orderHash",
  verifyToken,
  upload.array("return_images", 5),
  async (req, res) => {
    try {
      const { orderHash } = req.params;
      const { reason, items, return_type } = req.body;
      const user_id = req.user.id;
      const isAdmin = req.user.role === "admin";
      const uploadedFiles = req.files || [];

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng cung cấp lý do trả hàng",
        });
      }

      // Tìm đơn hàng dựa trên order_hash
      const [[order]] = await db.query(
        `SELECT o.order_id, o.user_id, o.current_status, o.created_at, o.order_hash,
       u.user_name, u.user_gmail as user_email
       FROM orders o
       LEFT JOIN user u ON o.user_id = u.user_id
       WHERE o.order_hash = ?`,
        [orderHash]
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      // Kiểm tra quyền truy cập (chỉ admin hoặc chủ đơn hàng)
      if (!isAdmin && user_id !== order.user_id) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền trả lại đơn hàng này",
        });
      }

      // Kiểm tra trạng thái đơn hàng (chỉ cho phép trả hàng khi đơn hàng đã hoàn thành)
      if (order.current_status !== "SUCCESS") {
        return res.status(400).json({
          success: false,
          message: "Chỉ có thể trả lại đơn hàng đã giao thành công",
        });
      }

      // Upload hình ảnh lên Cloudinary
      let uploadedImageUrls = [];
      if (uploadedFiles.length > 0) {
        try {
          const uploadPromises = uploadedFiles.map((file) => {
            return new Promise((resolve, reject) => {
              cloudinary.uploader
                .upload_stream(
                  {
                    folder: "order_returns",
                    public_id: `return_${orderHash}_${Date.now()}_${Math.random()
                      .toString(36)
                      .substr(2, 9)}`,
                    resource_type: "image",
                  },
                  (error, result) => {
                    if (error) {
                      reject(error);
                    } else {
                      resolve(result.secure_url);
                    }
                  }
                )
                .end(file.buffer);
            });
          });

          uploadedImageUrls = await Promise.all(uploadPromises);
        } catch (uploadError) {
          return res.status(500).json({
            success: false,
            message: "Lỗi khi upload hình ảnh",
            error: uploadError.message,
          });
        }
      }

      // Bắt đầu transaction
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // Lấy danh sách sản phẩm trong đơn hàng
        const [orderItems] = await connection.query(
          `SELECT oi.order_item_id, oi.variant_id, oi.quantity, oi.product_price, 
         vp.product_id, p.product_name, p.product_image
         FROM order_items oi
         LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
         LEFT JOIN product p ON vp.product_id = p.product_id
         WHERE oi.order_id = ?`,
          [order.order_id]
        );

        // Nếu có danh sách sản phẩm cụ thể được yêu cầu trả lại
        let itemsToReturn = orderItems;
        let totalRefundAmount = 0;

        if (items && Array.isArray(items) && items.length > 0) {
          // Lọc ra các sản phẩm được yêu cầu trả lại
          itemsToReturn = orderItems.filter((item) =>
            items.some(
              (returnItem) =>
                returnItem.order_item_id === item.order_item_id &&
                returnItem.quantity > 0 &&
                returnItem.quantity <= item.quantity
            )
          );

          if (itemsToReturn.length === 0) {
            throw new Error("Không tìm thấy sản phẩm hợp lệ để trả lại");
          }

          // Tính tổng số tiền hoàn lại
          for (const item of itemsToReturn) {
            const returnItem = items.find(
              (i) => i.order_item_id === item.order_item_id
            );
            const returnQuantity = Math.min(returnItem.quantity, item.quantity);
            totalRefundAmount += returnQuantity * item.product_price;

            // Khôi phục số lượng tồn kho
            if (item.product_id) {
              await connection.query(
                "UPDATE product SET product_stock = product_stock + ? WHERE product_id = ?",
                [returnQuantity, item.product_id]
              );
            }
          }
        } else {
          // Trả lại toàn bộ đơn hàng
          // Tính tổng số tiền hoàn lại
          for (const item of itemsToReturn) {
            totalRefundAmount += item.quantity * item.product_price;

            // Khôi phục số lượng tồn kho
            if (item.product_id) {
              await connection.query(
                "UPDATE product SET product_stock = product_stock + ? WHERE product_id = ?",
                [item.quantity, item.product_id]
              );
            }
          }
        }

        // Chuyển đổi array URL thành JSON string để lưu vào database
        const returnImagesJson =
          uploadedImageUrls.length > 0
            ? JSON.stringify(uploadedImageUrls)
            : null;

        // Tạo bản ghi trả hàng với return_type = 'REFUND'
        const [result] = await connection.query(
          `INSERT INTO order_returns (
          order_id, user_id, reason, return_images, return_type, total_refund, status, created_at
        ) VALUES (?, ?, ?, ?, 'REFUND', ?, 'PENDING', NOW())`,
          [order.order_id, user_id, reason, returnImagesJson, totalRefundAmount]
        );

        const returnId = result.insertId;

        // Lưu chi tiết sản phẩm trả lại
        for (const item of itemsToReturn) {
          const returnItem = items
            ? items.find((i) => i.order_item_id === item.order_item_id)
            : item;
          const returnQuantity = returnItem
            ? returnItem.quantity
            : item.quantity;

          if (returnQuantity > 0) {
            await connection.query(
              `INSERT INTO return_items (
              return_id, order_item_id, quantity, price, created_at
            ) VALUES (?, ?, ?, ?, NOW())`,
              [returnId, item.order_item_id, returnQuantity, item.product_price]
            );
          }
        }

        // Cập nhật trạng thái đơn hàng thành 'RETURN' nếu trả lại toàn bộ
        if (!items || items.length === 0) {
          await connection.query(
            `UPDATE orders SET current_status = 'RETURN', status_updated_by = ?, status_updated_at = NOW(), 
           note = CONCAT(IFNULL(note, ''), ?) WHERE order_id = ?`,
            [
              isAdmin ? "admin" : "user",
              `\nĐơn hàng đã được trả lại. Lý do: ${reason}`,
              order.order_id,
            ]
          );

          // Ghi log trạng thái
          await connection.query(
            `INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) 
           VALUES (?, ?, 'RETURN', ?, ?, NOW())`,
            [
              order.order_id,
              order.current_status,
              isAdmin ? "admin" : "user",
              `Đơn hàng đã được trả lại`,
            ]
          );
        }

        // Tạo thông báo cho admin nếu người dùng yêu cầu trả hàng
        if (!isAdmin) {
          try {
            // Kiểm tra xem bảng notifications có tồn tại không
            const [tables] = await connection.query(
              "SHOW TABLES LIKE 'notifications'"
            );

            if (tables.length > 0) {
              // Lấy tên các cột trong bảng notifications
              const [columns] = await connection.query(
                "SHOW COLUMNS FROM notifications"
              );

              const columnNames = columns.map((col) => col.Field);

              // Tìm admin để gửi thông báo
              const [[admin]] = await connection.query(
                "SELECT user_id FROM user WHERE role = 'admin' LIMIT 1"
              );

              if (admin && columnNames.includes("user_id")) {
                await connection.query(
                  `INSERT INTO notifications (user_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ORDER_RETURN', ?, ?, NOW(), 0)`,
                  [
                    admin.user_id,
                    `Đơn hàng #${order.order_hash} có yêu cầu trả hàng mới với ${uploadedImageUrls.length} hình ảnh`,
                    order.order_id,
                  ]
                );
              }
            }
          } catch (notificationError) {
            // Không throw lỗi để transaction vẫn tiếp tục
          }
        }

        // Commit transaction
        await connection.commit();

        return res.status(200).json({
          success: true,
          message: "Yêu cầu trả hàng đã được ghi nhận",
          data: {
            return_id: returnId,
            order_id: order.order_id,
            order_hash: order.order_hash,
            reason,
            return_images: uploadedImageUrls,
            total_refund: totalRefundAmount,
            items: itemsToReturn.map((item) => ({
              order_item_id: item.order_item_id,
              product_name: item.product_name,
              quantity: items
                ? items.find((i) => i.order_item_id === item.order_item_id)
                  ?.quantity || 0
                : item.quantity,
              price: item.product_price,
            })),
          },
        });
      } catch (error) {
        // Rollback nếu có lỗi
        await connection.rollback();

        // Xóa hình ảnh đã upload nếu có lỗi
        if (uploadedImageUrls.length > 0) {
          try {
            const deletePromises = uploadedImageUrls.map((url) => {
              const publicId = url.split("/").pop().split(".")[0];
              return cloudinary.uploader.destroy(`order_returns/${publicId}`);
            });
            await Promise.all(deletePromises);
          } catch (deleteError) {
          }
        }

        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Đã xảy ra lỗi khi xử lý yêu cầu trả hàng",
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/orders/return/count
 * @desc    Count return order requests
 * @access  Private (Admin)
 */
router.get("/return/count", verifyToken, isAdmin, async (req, res) => {
  try {
    // Check if order_returns table exists
    let count = 0;

    try {
      const [tables] = await db.query("SHOW TABLES LIKE 'order_returns'");

      if (tables.length > 0) {
        // If the table exists, count the number of return requests
        const [result] = await db.query(
          "SELECT COUNT(*) as count FROM order_returns"
        );
        count = result[0].count;
      } else {
        // Alternative: check if there are orders with RETURNED status
        const [result] = await db.query(
          "SELECT COUNT(*) as count FROM orders WHERE current_status = 'RETURNED'"
        );
        count = result[0].count;
      }
    } catch (error) {
      // Fallback to checking orders with RETURNED status
      const [result] = await db.query(
        "SELECT COUNT(*) as count FROM orders WHERE current_status = 'RETURNED'"
      );
      count = result[0].count;
    }

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while counting return orders",
      error: error.message,
    });
  }
});

module.exports = router;
