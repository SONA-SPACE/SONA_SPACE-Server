const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');
const crypto = require("crypto");
const axios = require("axios");
const {VNPay, ignoreLogger, dateFormat} = require('vnpay')
// Áp dụng middleware xác thực cho tất cả các route
router.use(verifyToken);


/**
 * @route   GET /api/orders/count
 * @desc    Lấy số lượng đơn hàng theo trạng thái (chỉ admin)
 * @access  Private (Admin)
 */
router.get('/count', async (req, res) => {
  try {
    const [result] = await db.query(`
      SELECT order_status_id, COUNT(*) as count
      FROM \`order\`
      GROUP BY order_status_id
    `);

    // Lấy danh sách tất cả trạng thái
    const [statuses] = await db.query('SELECT order_status_id, order_status_name FROM order_status');

    // Kết hợp số lượng đơn hàng với tên trạng thái
    const statusCounts = statuses.map(status => {
      const count = result.find(r => r.order_status_id === status.order_status_id);
      return {
        status_id: status.order_status_id,
        status_name: status.order_status_name,
        count: count ? count.count : 0
      };
    });

    res.json({ status_counts: statusCounts });
  } catch (error) {
    console.error('Error counting orders by status:', error);
    res.status(500).json({ error: 'Failed to count orders' });
  }
});

/**
 * @route   GET /api/orders
 * @desc    Lấy danh sách tất cả đơn hàng (admin only)
 * @access  Private (Admin)
 */
router.get('/', isAdmin, async (req, res) => {
  try {
    console.log('Đang truy cập GET /api/orders');
    console.log('User info:', req.user);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status_id = req.query.status_id;
    const search = req.query.search;

    console.log('Query params:', { page, limit, offset, status_id, search });

    // Xây dựng điều kiện tìm kiếm
    let conditions = [];
    let params = [];

    if (status_id) {
      conditions.push('o.order_status_id = ?');
      params.push(status_id);
    }

    if (search) {
      conditions.push('(o.order_hash LIKE ? OR u.user_gmail LIKE ? OR u.user_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    console.log('Where clause:', whereClause);
    console.log('Params:', params);

    // Đếm tổng số đơn hàng
    console.log('Executing count query...');
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM \`order\` o
      LEFT JOIN user u ON o.user_id = u.user_id
      ${whereClause}
    `;
    console.log('Count query:', countQuery);

    try {
      const [countResult] = await db.query(countQuery, params);
      console.log('Count result:', countResult);

      const totalOrders = countResult[0].total;
      const totalPages = Math.ceil(totalOrders / limit);

      // Lấy danh sách đơn hàng với phân trang
      console.log('Executing orders query...');
      const ordersQuery = `
        SELECT 
          o.*,
          os.order_status_name as status_name,
          u.user_gmail as user_email,
          u.user_name as user_name
        FROM \`order\` o
        LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
        LEFT JOIN user u ON o.user_id = u.user_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ?, ?
      `;
      console.log('Orders query:', ordersQuery);
      console.log('Orders params:', [...params, offset, limit]);

      const [orders] = await db.query(ordersQuery, [...params, offset, limit]);
      console.log(`Found ${orders.length} orders`);

      res.json({
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalOrders,
          ordersPerPage: limit
        }
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Lấy thông tin chi tiết một đơn hàng
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    console.log('Đang truy cập GET /api/orders/:id với id =', req.params.id);
    const orderId = Number(req.params.id);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Lấy thông tin đơn hàng
    console.log('Executing order query...');
    const orderQuery = `
      SELECT 
        o.*,
        os.order_status_name as status_name,
        u.user_gmail as user_email,
        u.user_name as user_name,
        u.user_number as user_phone
      FROM \`order\` o
      LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
      LEFT JOIN user u ON o.user_id = u.user_id
      WHERE o.order_id = ?
    `;
    console.log('Order query:', orderQuery);

    let orders;
    try {
      [orders] = await db.query(orderQuery, [orderId]);
      console.log('Order query result length:', orders.length);
    } catch (error) {
      console.error('Error in order query:', error);
      return res.status(500).json({ error: 'Failed to fetch order', details: error.message });
    }

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Kiểm tra quyền truy cập (chỉ admin hoặc chủ đơn hàng)
    if (req.user.role !== 'admin' && req.user.id !== order.user_id) {
      return res.status(403).json({ error: 'You do not have permission to view this order' });
    }

    try {
      // Lấy chi tiết đơn hàng (sản phẩm)
      console.log('Executing order items query...');
      const orderItemsQuery = `
        SELECT 
          oi.*,
          p.product_name,
          p.product_sku,
          p.product_image
        FROM order_items oi
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
      `;
      console.log('Order items query:', orderItemsQuery);

      let orderItems;
      try {
        [orderItems] = await db.query(orderItemsQuery, [orderId]);
        console.log('Order items query result length:', orderItems.length);
        order.items = orderItems;
      } catch (error) {
        console.error('Error in order items query:', error);
        order.items = [];
      }

      // Lấy lịch sử trạng thái đơn hàng
      console.log('Executing status logs query...');
      const statusLogsQuery = `
        SELECT 
          osl.*,
          os.order_status_name as status_name
        FROM order_status_log osl
        LEFT JOIN order_status os ON osl.order_status_id = os.order_status_id
        WHERE osl.order_id = ?
        ORDER BY osl.created_at ASC
      `;
      console.log('Status logs query:', statusLogsQuery);

      let statusLogs;
      try {
        [statusLogs] = await db.query(statusLogsQuery, [orderId]);
        console.log('Status logs query result length:', statusLogs.length);
        order.status_logs = statusLogs;
      } catch (error) {
        console.error('Error in status logs query:', error);
        order.status_logs = [];
      }

      res.json(order);
    } catch (error) {
      console.error('Error fetching order details:', error);
      res.status(500).json({ error: 'Failed to fetch order details', details: error.message });
    }
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order', details: error.message });
  }
});

/**
 * @route   POST /api/orders
 * @desc    Tạo đơn hàng mới
 * @access  Private
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      order_id,
      order_total,
      order_status,
      method, // COD | MOMO
      amount,
      order_address_new,
      order_number2
    } = req.body;

    const user_id = req.user.id;

    // Validate tối thiểu
    if (!order_id || !order_total || !method || !amount) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    // Lấy địa chỉ và SĐT mặc định từ DB
    // Lấy địa chỉ và SĐT mặc định từ DB
    const [[userInfo]] = await db.query(`
  SELECT user_address, user_number FROM user WHERE user_id = ?
`, [user_id]);

    if (!userInfo) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const defaultAddress = userInfo.user_address?.trim() || '';
    const defaultPhone = userInfo.user_number?.trim() || '';

    const finalAddressOld = defaultAddress;
    const finalAddressNew = (order_address_new?.trim() && order_address_new.trim() !== defaultAddress)
      ? order_address_new.trim()
      : null;

    let finalNumber1 = defaultPhone;
    const finalNumber2 = (order_number2?.trim() && order_number2.trim() !== defaultPhone)
      ? order_number2.trim()
      : null;

    // Kiểm tra trùng đơn hàng
    const [existingOrders] = await db.query('SELECT * FROM orders WHERE order_hash = ?', [order_id]);
    if (existingOrders.length > 0) {
      return res.status(400).json({ error: 'Đơn hàng đã tồn tại' });
    }

    // ✅ Tạo đơn hàng
    await db.query(`
      INSERT INTO orders (
        order_hash, user_id, order_address_old, order_address_new,
        order_number1, order_number2, order_total, order_total_final, 
        current_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      order_id,
      user_id,
      finalAddressOld,
      finalAddressNew,
      finalNumber1,
      finalNumber2,
      order_total,
      order_total,
      order_status || "PENDING"
    ]);

    // Xử lý thanh toán MOMO
    if (method === 'MOMO') {
      const partnerCode = 'MOMO';
      const accessKey = 'F8BBA842ECF85';
      const secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
      const requestId = partnerCode + new Date().getTime();
      const momoOrderId = requestId;
      const orderInfo = `Thanh toán đơn hàng #${order_id}`;
      const redirectUrl = 'http://localhost:5173/thanh-toan';
      const ipnUrl = 'http://localhost:3501/api/orders';
      const requestType = 'captureWallet';
      const extraData = '';

      const rawSignature =
        `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
        `&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
        `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

      const requestBody = {
        partnerCode,
        accessKey,
        requestId,
        amount: `${amount}`,
        orderId: momoOrderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: 'vi'
      };

      const momoResponse = await axios.post(
        'https://test-payment.momo.vn/v2/gateway/api/create',
        requestBody,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { payUrl } = momoResponse.data;

      const [[orderRow]] = await db.query('SELECT order_id FROM orders WHERE order_hash = ?', [order_id]);
      if (!orderRow) return res.status(500).json({ error: 'Không tìm thấy order_id sau khi tạo đơn hàng' });

      await db.query(`
        INSERT INTO payments (order_id, method, amount, status, transaction_code, created_at)
        VALUES (?, ?, ?, 'PENDING', ?, NOW())
      `, [orderRow.order_id, method, amount, momoOrderId]);

      return res.status(200).json({
        message: "Order and MoMo payment created",
        payUrl,
        order_id
      });
    }
    // xử lý thanh toán VNPAY
   if (method === 'VNPAY') {
  const [[orderRow]] = await db.query('SELECT order_id FROM orders WHERE order_hash = ?', [order_id]);
  if (!orderRow) {
    return res.status(500).json({ error: 'Không tìm thấy order_id sau khi tạo đơn hàng' });
  }

  // Tạo mã giao dịch riêng
  const transactionCode = `VNP${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Khởi tạo đối tượng VNPAY
  const vnpay = new VNPay({
    tmnCode: 'DHF21S3V',
    secureSecret: 'NXM2DJWRF8RLC4R5VBK85OJZS1UE9KI6F',
    vnpayHost: 'https://sandbox.vnpayment.vn',
    testMode: true,
    hashAlgorithm: 'SHA512',
    loggerFn: ignoreLogger,
  });

  // Ngày hết hạn thanh toán
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Tạo URL thanh toán
  const paymentUrl = vnpay.buildPaymentUrl({
    vnp_Amount: amount * 100, // VNPAY yêu cầu nhân 100
    vnp_IpAddr: 'http://localhost:5173/thanh-toan',
    vnp_TxnRef: transactionCode,
    vnp_OrderInfo: `Thanh toán đơn hàng #${order_id}`,
    vnp_OrderType: 'other',
    vnp_ReturnUrl: 'http://localhost:3501/api/orders',
    vnp_Locale: 'vn',
    vnp_CreateDate: dateFormat(new Date(), "yyyymmddHHMMss"),
    vnp_ExpireDate: dateFormat(tomorrow, "yyyymmddHHMMss"),
  });

  // Lưu giao dịch thanh toán
  await db.query(`
    INSERT INTO payments (order_id, method, amount, status, transaction_code, created_at)
    VALUES (?, ?, ?, 'PENDING', ?, NOW())
  `, [orderRow.order_id, method, amount, transactionCode]);

  // Gửi URL thanh toán cho client
  return res.status(200).json({
    message: "Order and VNPAY payment created",
    payUrl: paymentUrl,
    order_id
  });
}



    //  Xử lý COD
    if (method === 'COD') {
      const [[orderRow]] = await db.query('SELECT order_id FROM orders WHERE order_hash = ?', [order_id]);
      if (!orderRow) return res.status(500).json({ error: 'Không tìm thấy order_id sau khi tạo đơn hàng' });

      await db.query(`
        INSERT INTO payments (order_id, method, amount, status, created_at)
        VALUES (?, ?, ?, 'SUCCESS', NOW())
      `, [orderRow.order_id, method, amount]);

      return res.status(201).json({
        message: 'COD order created and marked as paid',
        order_id
      });
    }

    return res.status(400).json({ error: 'Unsupported payment method' });
  } catch (error) {
    console.error("Error creating order/payment:", error);
    res.status(500).json({ error: 'Server error during order/payment' });
  }
});

router.get('/:orderHash', async (req, res) => {
  const { orderHash } = req.params;

  try {
    // Lấy thông tin đơn hàng theo order_hash
    const [[order]] = await db.query(
      `
      SELECT 
        o.order_id,
        o.order_hash,
        o.created_at,
        o.order_total_final,
        (
          SELECT SUM(quantity)
          FROM order_items
          WHERE order_id = o.order_id
        ) AS total_quantity
      FROM orders o
      WHERE o.order_hash = ?
      `,
      [orderHash]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    return res.status(200).json({
      success: true,
      order: {
        order_id: order.order_id,
        order_hash: order.order_hash,
        created_at: order.created_at,
        order_total_final: order.order_total_final,
        total_quantity: order.total_quantity || 0
      }
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});


/**
 * @route   PUT /api/orders/:id/status
 * @desc    Cập nhật trạng thái đơn hàng
 * @access  Private (Admin)
 */
router.put('/:id/status', isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status_id, note } = req.body;

    if (isNaN(orderId) || !status_id) {
      return res.status(400).json({ error: 'Invalid order ID or status ID' });
    }

    // Kiểm tra đơn hàng tồn tại
    const [existingOrder] = await db.query(
      'SELECT order_id, order_status_id FROM `order` WHERE order_id = ?',
      [orderId]
    );

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Kiểm tra trạng thái tồn tại
    const [existingStatus] = await db.query(
      'SELECT order_status_id FROM order_status WHERE order_status_id = ?',
      [status_id]
    );

    if (existingStatus.length === 0) {
      return res.status(404).json({ error: 'Status not found' });
    }

    // Cập nhật trạng thái đơn hàng
    await db.query(
      'UPDATE `order` SET order_status_id = ?, updated_at = NOW() WHERE order_id = ?',
      [status_id, orderId]
    );

    // Thêm vào lịch sử trạng thái
    await db.query(`
      INSERT INTO order_status_log (order_id, order_status_id, note, created_at)
      VALUES (?, ?, ?, NOW())
    `, [orderId, status_id, note || null]);

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * @route   DELETE /api/orders/:id
 * @desc    Hủy đơn hàng (chỉ admin hoặc chủ đơn hàng mới tạo)
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Kiểm tra đơn hàng tồn tại
    const [existingOrder] = await db.query(`
      SELECT order_id, user_id, order_status_id, created_at 
      FROM \`order\` WHERE order_id = ?
    `, [orderId]);

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = existingOrder[0];

    // Kiểm tra quyền hủy đơn hàng
    if (req.user.role !== 'admin' && req.user.id !== order.user_id) {
      return res.status(403).json({ error: 'You do not have permission to cancel this order' });
    }

    // Chỉ cho phép hủy đơn hàng ở trạng thái mới tạo hoặc chờ xác nhận
    if (order.order_status_id > 2 && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'Cannot cancel order in current status' });
    }

    // Chỉ khách hàng mới được hủy đơn hàng trong vòng 24 giờ sau khi tạo
    if (req.user.role !== 'admin') {
      const orderDate = new Date(order.created_at);
      const currentDate = new Date();
      const hoursDiff = (currentDate - orderDate) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return res.status(400).json({ error: 'Cannot cancel order after 24 hours' });
      }
    }

    // Bắt đầu transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Lấy danh sách sản phẩm trong đơn hàng
      const [orderItems] = await connection.query(
        'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );

      // Khôi phục số lượng tồn kho
      for (const item of orderItems) {
        if (item.variant_id) {
          await connection.query(
            'UPDATE variant_product SET stock = stock + ? WHERE variant_id = ?',
            [item.quantity, item.variant_id]
          );
        } else {
          await connection.query(
            'UPDATE product SET stock = stock + ? WHERE product_id = ?',
            [item.quantity, item.product_id]
          );
        }
      }

      // Cập nhật trạng thái đơn hàng sang "Đã hủy"
      await connection.query(
        'UPDATE `order` SET order_status_id = 6, updated_at = NOW() WHERE order_id = ?',
        [orderId]
      );

      // Thêm vào lịch sử trạng thái
      await connection.query(`
        INSERT INTO order_status_log (order_id, order_status_id, note, created_at)
        VALUES (?, 6, ?, NOW())
      `, [orderId, 'Order cancelled by ' + (req.user.role === 'admin' ? 'admin' : 'customer')]);

      // Commit transaction
      await connection.commit();

      res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
      // Rollback nếu có lỗi
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

/**
 * @route   GET /api/orders/status/count
 * @desc    Lấy số lượng đơn hàng theo trạng thái (chỉ admin)
 * @access  Private (Admin)
 */
router.get('/status/count', isAdmin, async (req, res) => {
  try {
    const [result] = await db.query(`
      SELECT order_status_id, COUNT(*) as count
      FROM \`order\`
      GROUP BY order_status_id
    `);

    // Lấy danh sách tất cả trạng thái
    const [statuses] = await db.query('SELECT order_status_id, order_status_name FROM order_status');

    // Kết hợp số lượng đơn hàng với tên trạng thái
    const statusCounts = statuses.map(status => {
      const count = result.find(r => r.order_status_id === status.order_status_id);
      return {
        status_id: status.order_status_id,
        status_name: status.order_status_name,
        count: count ? count.count : 0
      };
    });

    res.json(statusCounts);
  } catch (error) {
    console.error('Error fetching order status counts:', error);
    res.status(500).json({ error: 'Failed to fetch order status counts' });
  }
});

module.exports = router; 