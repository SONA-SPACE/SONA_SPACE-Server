const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin, optionalAuth } = require("../middleware/auth");
const crypto = require("crypto");

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
  console.log("🔍 Truy vấn đơn hàng:", orderHash);

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
    console.error("Lỗi lấy thông tin đơn hàng:", error.message);
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
      PENDING: 1,
      CONFIRMED: 2,
      SHIPPING: 3,
      SUCCESS: 4,
    };
    const statusStep = statusStepMap[order.current_status] || 1;

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

    return res.status(200).json({
      success: true,
      order: {
        id: order.order_id,
        order_hash: order.order_hash,
        date: order.created_at,
        status: order.current_status,
        statusStep,
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
          price: item.price_sale ? cleanPrice(item.price_sale) : cleanPrice(item.price),


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
      },
    });
  } catch (error) {
    console.error(" Lỗi khi truy vấn đơn hàng:", error.message);
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
        COUNT(oi.order_item_id) AS item_count
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
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
    `);

    // Process orders to include payment array
    const processedOrders = orders.map(order => {
      // Create payment array if payment data exists
      if (order.payment_method || order.payment_status_from_payment) {
        order.payment = [{
          method: order.payment_method || 'N/A',
          status: order.payment_status_from_payment || order.payment_status || 'PENDING',
          transaction_code: null,
          paid_at: null
        }];
      }

      // Remove the extra fields used for processing
      delete order.payment_status_from_payment;

      return order;
    });

    res.json({ success: true, orders: processedOrders });
  } catch (err) {
    console.error("Error fetching orders:", err);
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
    console.error("Error counting orders by status:", error);
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
    console.log("Đang truy cập GET /api/orders");
    console.log("User info:", req.user);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status; // Changed from status_id to status
    const search = req.query.search;

    console.log("Query params:", { page, limit, offset, status, search });

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
    console.log("Where clause:", whereClause);
    console.log("Params:", params);

    // Đếm tổng số đơn hàng
    console.log("Executing count query...");
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM \`orders\` o
      LEFT JOIN user u ON o.user_id = u.user_id
      ${whereClause}
    `;
    console.log("Count query:", countQuery);

    try {
      const [countResult] = await db.query(countQuery, params);
      console.log("Count result:", countResult);

      const totalOrders = countResult[0].total;
      const totalPages = Math.ceil(totalOrders / limit);

      // Lấy danh sách đơn hàng với phân trang
      console.log("Executing orders query...");
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
      console.log("Orders query:", ordersQuery);
      console.log("Orders params:", [...params, offset, limit]);

      const [orders] = await db.query(ordersQuery, [...params, offset, limit]);
      console.log(`Found ${orders.length} orders`);

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
      console.error("Database error:", dbError);
      throw dbError;
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
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
      fromRedirect
    } = req.body;

    const user_id = req.user.id;

    if (!order_id || !order_total || !method || !amount) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    if (method === "MOMO" && !fromRedirect) {
      return res.status(400).json({ error: "Chờ IPN hoặc fromRedirect mới được tạo đơn" });
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

      // Insert order
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
          order_total,
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
        `SELECT order_id FROM orders WHERE order_hash = ?`,
        [order_id]
      );
      const orderId = orderRow.order_id;

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
        console.error("Lỗi gửi email:", err.message);
      }

      return res.status(201).json({
        message: "Đơn hàng COD đã được tạo",
        redirect: `/dat-hang-thanh-cong/${order_id}`,
        order_hash: order_id,
        order_id: orderId,
      });
    }

    // MoMo: không lưu đơn → trả về payUrl
    // MoMo: không lưu đơn → trả về payUrl
    if (method === "MOMO") {
      const partnerCode = "MOMO";
      const accessKey = "F8BBA842ECF85";
      const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
      const requestType = "captureWallet";

      const orderId = req.body.order_id || `SNA-${Date.now()}`;

      const requestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const redirectUrl = `https://6c86ca6c5a20.ngrok-free.app/api/orders/redirect/momo`;
      const ipnUrl = `https://6c86ca6c5a20.ngrok-free.app/api/orders/payment/momo`;
      const orderInfo = "Thanh toán đơn hàng";

      const extraData = Buffer.from(JSON.stringify({
        order_id: orderId,
        user_id,
        order_total,
        order_address_new,
        order_number2,
        order_name_new,
        order_email_new,
        couponcode_id,
        cart_items,
        coupon_code,
        shipping_fee,
        order_discount
      })).toString('base64');

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

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
        lang: 'vi'
      };

      const momoRes = await axios.post(
        'https://test-payment.momo.vn/v2/gateway/api/create',
        momoBody,
        { headers: { 'Content-Type': 'application/json' } }
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
        vnp_ReturnUrl: "http://localhost:3501/api/orders/payment/vnpay",
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
    console.error("Error:", err);
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
    const expectedSignature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");

    if (signature !== expectedSignature || parseInt(resultCode) !== 0) {
      return res.status(400).json({ message: "Chữ ký không hợp lệ hoặc thanh toán thất bại" });
    }

    // Kiểm tra đơn đã tồn tại chưa
    const [existingOrder] = await db.query("SELECT * FROM orders WHERE order_hash = ?", [orderId]);
    if (existingOrder.length > 0) {
      const existingOrderId = existingOrder[0].order_id;

      const [existingPayment] = await db.query(
        "SELECT * FROM payments WHERE order_id = ? AND method = 'MOMO'",
        [existingOrderId]
      );

      if (existingPayment.length === 0) {
        await db.query(`
          INSERT INTO payments (order_id, method, amount, status, transaction_code, created_at)
          VALUES (?, 'MOMO', ?, 'PAID', ?, NOW())
        `, [existingOrderId, amount, transId]);

        await db.query(`
          INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at)
          VALUES (?, NULL, 'PAID', 'system', 'Xác nhận lại MoMo', NOW())
        `, [existingOrderId]);
      }

      return res.status(200).json({ message: "Đơn hàng đã tồn tại và đã xử lý thanh toán." });
    }

    // Giải mã extraData
    const extra = JSON.parse(Buffer.from(extraData, "base64").toString("utf8"));
    const {
      user_id,
      order_total,
      cart_items = [],
      order_name_new,
      order_email_new,
      order_address_new,
      order_number2,
      couponcode_id,
      coupon_code,
      shipping_fee,
      order_discount
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

    const finalName = order_name_new?.trim() && order_name_new.trim() !== defaultName ? order_name_new.trim() : null;
    const finalEmail = order_email_new?.trim() && order_email_new.trim() !== defaultEmail ? order_email_new.trim() : null;
    const finalAddress = order_address_new?.trim() && order_address_new.trim() !== defaultAddress ? order_address_new.trim() : null;
    const finalPhone = order_number2?.trim() && order_number2.trim() !== defaultPhone ? order_number2.trim() : null;

    let couponcodeId = couponcode_id || null;
    if (!couponcodeId && coupon_code) {
      const [[coupon]] = await db.query(`SELECT couponcode_id FROM couponcode WHERE code = ?`, [coupon_code]);
      if (coupon) couponcodeId = coupon.couponcode_id;
    }

    await db.query(`
      INSERT INTO orders (
        order_hash, user_id, order_address_old, order_address_new,
        order_number1, order_number2, order_total, order_total_final,
        shipping_fee, order_discount,
        current_status, created_at,
        order_name_old, order_name_new,
        order_email_old, order_email_new,
        couponcode_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
    `, [
      order_hash,
      user_id,
      defaultAddress,
      finalAddress,
      defaultPhone,
      finalPhone,
      order_total,
      order_total,
      shipping_fee,
      order_discount,
      "PENDING",
      defaultName,
      finalName,
      defaultEmail,
      finalEmail,
      couponcodeId,
    ]);

    const [[orderRow]] = await db.query(`SELECT order_id FROM orders WHERE order_hash = ?`, [order_hash]);
    const order_id = orderRow.order_id;

    for (const item of cart_items) {
      const { variant_id, quantity, name: product_name, price: product_price } = item;
      if (!variant_id || !quantity || !product_name || !product_price) continue;

      await db.query(`
        INSERT INTO order_items (order_id, variant_id, quantity, product_name, product_price, current_status, created_at)
        VALUES (?, ?, ?, ?, ?, 'NORMAL', NOW())
      `, [order_id, variant_id, quantity, product_name, product_price]);

      // Cập nhật số lượng tồn kho và sản phẩm bán
      await db.query(`
        UPDATE variant_product SET variant_product_quantity = variant_product_quantity - ? WHERE variant_id = ?
      `, [quantity, variant_id]);

      await db.query(`
        UPDATE product
        JOIN variant_product ON variant_product.product_id = product.product_id
        SET product.product_sold = product.product_sold + ?
        WHERE variant_product.variant_id = ?
      `, [quantity, variant_id]);
    }

    const wishlistIdsToDelete = [];

    for (const item of cart_items) {
      const [wishlistRows] = await db.query(
        `SELECT wishlist_id FROM wishlist WHERE user_id = ? AND variant_id = ?`,
        [user_id, item.variant_id]
      );
      wishlistRows.forEach((row) => wishlistIdsToDelete.push(row.wishlist_id));
    }

    if (wishlistIdsToDelete.length > 0) {
      await db.query(
        `DELETE FROM wishlist WHERE wishlist_id IN (?)`,
        [wishlistIdsToDelete]
      );
    }

    await db.query(`
      INSERT INTO payments (order_id, method, amount, status, transaction_code, created_at)
      VALUES (?, 'MOMO', ?, 'SUCCESS', ?, NOW())
    `, [order_id, amount, transId]);

    await db.query(`
      INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at)
      VALUES (?, NULL, 'PAID', 'system', 'Khởi tạo đơn', NOW())
    `, [order_id]);

    // Gửi email xác nhận
    const emailData = {
      name: finalName || defaultName,
      email: finalEmail || defaultEmail,
      phone: finalPhone || defaultPhone,
      address: finalAddress || defaultAddress,
      amount,
      method: "MOMO",
      order_id,
      order_hash,
      created_at: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      current_status: "PENDING",
      order_total_final: amount.toLocaleString("vi-VN") + "đ",
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
      console.error("Lỗi gửi email:", err.message);
    }

    return res.status(200).json({
      success: true,
      resultCode: 0,
      message: "Đơn hàng đã thanh toán thành công qua MoMo",
    });

  } catch (error) {
    console.error("MoMo IPN error:", error);
    return res.status(500).json({ error: "Lỗi server khi xử lý IPN MoMo" });
  }
});


router.get("/redirect/momo", (req, res) => {
  const { resultCode, orderId } = req.query;

  if (parseInt(resultCode) === 0) {
    return res.redirect(`http://localhost:5173/dat-hang-thanh-cong/${orderId}`);
  }

  return res.redirect("http://localhost:5173/");
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
      console.log("Order query result length:", orders.length);
    } catch (error) {
      console.error("Error in order query:", error);
      return res.status(500).json({ error: "Failed to fetch order", details: error.message });
    }

    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    let order = orders[0];

    // Gộp thông tin thanh toán vào array `payment[]`, rồi xoá các field gốc
    order.payment = [{
      method: order.payment_method,
      status: order.payment_status,
      transaction_code: order.payment_transaction_code,
      paid_at: order.payment_paid_at
    }];
    delete order.payment_method;
    delete order.payment_status;
    delete order.payment_transaction_code;
    delete order.payment_paid_at;

    // Kiểm tra quyền truy cập
    if (req.user.role !== "admin" && req.user.id !== order.user_id) {
      return res.status(403).json({ error: "You do not have permission to view this order" });
    }

    try {
      // Lấy chi tiết sản phẩm
      const orderItemsQuery = `
        SELECT 
          oi.*,
          p.product_name,
          p.product_image
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        WHERE oi.order_id = ?
      `;

      let orderItems;
      try {
        [orderItems] = await db.query(orderItemsQuery, [orderId]);
        order.items = orderItems;
      } catch (error) {
        console.error("Error in order items query:", error);
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
        console.error("Error in status logs query:", error);
        order.status_logs = [];
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order details", details: error.message });
    }
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order", details: error.message });
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
    // Lấy trạng thái hiện tại
    const [[order]] = await db.query(
      "SELECT current_status FROM orders WHERE order_id = ?",
      [orderId]
    );
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });

    const fromStatus = order.current_status;
    const toStatus = new_status;

    if (fromStatus === toStatus) {
      return res
        .status(200)
        .json({ success: true, message: "Trạng thái không thay đổi" });
    }

    // Cập nhật trạng thái
    await db.query("UPDATE orders SET current_status = ? WHERE order_id = ?", [
      toStatus,
      orderId,
    ]);

    // Ghi log chuyển trạng thái
    await db.query(
      `
      INSERT INTO order_status_log (
        order_id, from_status, to_status, trigger_by, step, created_at
      ) VALUES (?, ?, ?, 'admin', ?, NOW())
    `,
      [
        orderId,
        fromStatus,
        toStatus,
        `Chuyển trạng thái từ ${fromStatus} ➝ ${toStatus}`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: `Đã chuyển trạng thái đơn hàng sang ${toStatus}`,
      new_status: toStatus,
    });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi cập nhật trạng thái" });
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
    console.error("Error cancelling order:", error);
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
    console.error("Error fetching order status counts:", error);
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
    console.log(`Gửi hóa đơn #${order_id} đến email: ${email}`);
    console.log(`URL hóa đơn: ${invoiceUrl}`);

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
    console.error("Error sending invoice:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi gửi hóa đơn",
      error: error.message,
    });
  }
});

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
        message: "Invalid order ID"
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
        message: "Order not found"
      });
    }

    // Start a transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Allowed fields to update in orders table
      const allowedOrderFields = [
        'order_name_new',
        'order_email_new',
        'order_number2',
        'order_address_new',
        'note'
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
          .map(key => `${key} = ?`)
          .join(', ');

        const values = [...Object.values(filteredData), orderId];

        await connection.query(
          `UPDATE orders SET ${setClause}, updated_at = NOW() WHERE order_id = ?`,
          values
        );
      }

      // Update payment method if provided
      if (paymentMethod) {
        // Check if valid payment method
        const validPaymentMethods = ['COD', 'BANK_TRANSFER', 'VNPAY', 'MOMO', 'ZALOPAY'];
        if (!validPaymentMethods.includes(paymentMethod)) {
          throw new Error('Invalid payment method');
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
        updatedFields: Object.keys(filteredData)
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
    console.error("Error updating order:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating order",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/orders/return/:orderHash
 * @desc    Process an order return request
 * @access  Private
 */
router.post("/return/:orderHash", verifyToken, async (req, res) => {
  try {
    const { orderHash } = req.params;
    const { reason, items, return_type } = req.body;
    const user_id = req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        message: "Vui lòng cung cấp lý do trả hàng" 
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
        message: "Không tìm thấy đơn hàng" 
      });
    }

    // Kiểm tra quyền truy cập (chỉ admin hoặc chủ đơn hàng)
    if (!isAdmin && user_id !== order.user_id) {
      return res.status(403).json({ 
        success: false, 
        message: "Bạn không có quyền trả lại đơn hàng này" 
      });
    }

    // Kiểm tra trạng thái đơn hàng (chỉ cho phép trả hàng khi đơn hàng đã hoàn thành)
    if (order.current_status !== 'SUCCESS') {
      return res.status(400).json({ 
        success: false, 
        message: "Chỉ có thể trả lại đơn hàng đã giao thành công" 
      });
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
        itemsToReturn = orderItems.filter(item => 
          items.some(returnItem => 
            returnItem.order_item_id === item.order_item_id && 
            returnItem.quantity > 0 && 
            returnItem.quantity <= item.quantity
          )
        );
        
        if (itemsToReturn.length === 0) {
          throw new Error('Không tìm thấy sản phẩm hợp lệ để trả lại');
        }
        
        // Tính tổng số tiền hoàn lại
        for (const item of itemsToReturn) {
          const returnItem = items.find(i => i.order_item_id === item.order_item_id);
          const returnQuantity = Math.min(returnItem.quantity, item.quantity);
          totalRefundAmount += returnQuantity * item.product_price;
          
          // Khôi phục số lượng tồn kho
          if (item.product_id) {
            await connection.query(
              'UPDATE product SET product_stock = product_stock + ? WHERE product_id = ?',
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
              'UPDATE product SET product_stock = product_stock + ? WHERE product_id = ?',
              [item.quantity, item.product_id]
            );
          }
        }
      }

      // Tạo bản ghi trả hàng
      const [result] = await connection.query(
        `INSERT INTO order_returns (
          order_id, user_id, reason, return_type, total_refund, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', NOW())`,
        [order.order_id, user_id, reason, return_type || 'REFUND', totalRefundAmount]
      );
      
      const returnId = result.insertId;
      
      // Lưu chi tiết sản phẩm trả lại
      for (const item of itemsToReturn) {
        const returnItem = items ? items.find(i => i.order_item_id === item.order_item_id) : item;
        const returnQuantity = returnItem ? returnItem.quantity : item.quantity;
        
        if (returnQuantity > 0) {
          await connection.query(
            `INSERT INTO return_items (
              return_id, order_item_id, quantity, price, created_at
            ) VALUES (?, ?, ?, ?, NOW())`,
            [returnId, item.order_item_id, returnQuantity, item.product_price]
          );
        }
      }

      // Cập nhật trạng thái đơn hàng nếu trả lại toàn bộ
      if (!items || items.length === 0) {
        await connection.query(
          `UPDATE orders SET current_status = 'RETURNED', status_updated_by = ?, status_updated_at = NOW(), 
           note = CONCAT(IFNULL(note, ''), ?) WHERE order_id = ?`,
          [isAdmin ? 'admin' : 'user', `\nĐơn hàng đã được trả lại. Lý do: ${reason}`, order.order_id]
        );
        
        // Ghi log trạng thái
        await connection.query(
          `INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) 
           VALUES (?, ?, 'RETURNED', ?, ?, NOW())`,
          [order.order_id, order.current_status, isAdmin ? 'admin' : 'user', `Đơn hàng đã được trả lại`]
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
            
            const columnNames = columns.map(col => col.Field);
            
            // Tìm admin để gửi thông báo
            const [[admin]] = await connection.query(
              "SELECT user_id FROM user WHERE role = 'admin' LIMIT 1"
            );
            
            if (admin && columnNames.includes('user_id')) {
              await connection.query(
                `INSERT INTO notifications (user_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ORDER_RETURN', ?, ?, NOW(), 0)`,
                [admin.user_id, `Đơn hàng #${order.order_hash} có yêu cầu trả hàng mới`, order.order_id]
              );
            }
          }
        } catch (notificationError) {
          console.error('Lỗi khi tạo thông báo:', notificationError);
          // Không throw lỗi để transaction vẫn tiếp tục
        }
      }

      // Commit transaction
      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Yêu cầu trả hàng đã được ghi nhận',
        data: {
          return_id: returnId,
          order_id: order.order_id,
          order_hash: order.order_hash,
          total_refund: totalRefundAmount,
          items: itemsToReturn.map(item => ({
            order_item_id: item.order_item_id,
            product_name: item.product_name,
            quantity: items ? items.find(i => i.order_item_id === item.order_item_id)?.quantity || 0 : item.quantity,
            price: item.product_price
          }))
        }
      });
    } catch (error) {
      // Rollback nếu có lỗi
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu trả hàng:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xử lý yêu cầu trả hàng',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders/return/count
 * @desc    Count return order requests
 * @access  Private (Admin)
 */
router.get('/return/count', verifyToken, isAdmin, async (req, res) => {
  try {
    // Check if order_returns table exists
    let count = 0;
    
    try {
      const [tables] = await db.query(
        "SHOW TABLES LIKE 'order_returns'"
      );
      
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
      console.error("Error checking order_returns table:", error);
      // Fallback to checking orders with RETURNED status
      const [result] = await db.query(
        "SELECT COUNT(*) as count FROM orders WHERE current_status = 'RETURNED'"
      );
      count = result[0].count;
    }
    
    return res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error("Error counting return orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while counting return orders",
      error: error.message
    });
  }
});

module.exports = router;
