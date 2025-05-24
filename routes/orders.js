const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

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
router.post('/', async (req, res) => {
  try {
    console.log('Receiving order creation request with body:', JSON.stringify(req.body));
    
    const {
      order_address1,
      order_city,
      order_postal,
      order_country,
      order_phone,
      order_email,
      order_name,
      note,
      coupon_code,
      items
    } = req.body;
    
    console.log('Extracted fields:');
    console.log('- order_address1:', order_address1);
    console.log('- order_city:', order_city);
    console.log('- order_phone:', order_phone);
    console.log('- order_name:', order_name);
    console.log('- items:', items ? JSON.stringify(items) : 'none');
    
    const user_id = req.user.id;
    
    // Kiểm tra các trường bắt buộc
    if (!order_address1 || !order_city || !order_phone || !order_name || !items || !items.length) {
      console.log('Missing required fields:');
      if (!order_address1) console.log('- Missing order_address1');
      if (!order_city) console.log('- Missing order_city');
      if (!order_phone) console.log('- Missing order_phone');
      if (!order_name) console.log('- Missing order_name');
      if (!items || !items.length) console.log('- Missing items');
      
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Tạo mã đơn hàng
    const orderHash = 'ORD' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    
    // Bắt đầu transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // Tạo đơn hàng mới
      const [orderResult] = await connection.query(`
        INSERT INTO \`order\` (
          user_id, order_hash, order_address1, order_city, 
          order_postal, order_country, order_phone, 
          order_email, order_name, note, order_status_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
      `, [
        user_id,
        orderHash,
        order_address1,
        order_city,
        order_postal || null,
        order_country || 'Vietnam',
        order_phone,
        order_email || null,
        order_name,
        note || null
      ]);
      
      const orderId = orderResult.insertId;
      
      // Tạo log trạng thái đơn hàng (mới tạo)
      await connection.query(`
        INSERT INTO order_status_log (order_id, order_status_id, created_at)
        VALUES (?, 1, NOW())
      `, [orderId]);
      
      // Thêm các sản phẩm vào đơn hàng
      let subtotal = 0;
      let total_items = 0;
      
      for (const item of items) {
        let productPrice = 0;
        let stock = 0;
        let variantPrice = 0;
        let variantStock = 0;
        
        // Kiểm tra và lấy thông tin sản phẩm
        const [productResult] = await connection.query(
          'SELECT price, stock FROM product WHERE product_id = ?',
          [item.product_id]
        );
        
        if (!productResult.length) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }
        
        productPrice = productResult[0].price;
        stock = productResult[0].stock;
        
        // Nếu có biến thể, kiểm tra và lấy thông tin biến thể
        if (item.variant_id) {
          const [variantResult] = await connection.query(
            'SELECT price, stock FROM variant_product WHERE variant_id = ? AND product_id = ?',
            [item.variant_id, item.product_id]
          );
          
          if (!variantResult.length) {
            throw new Error(`Variant with ID ${item.variant_id} not found for product ${item.product_id}`);
          }
          
          variantPrice = variantResult[0].price;
          variantStock = variantResult[0].stock;
          
          // Kiểm tra tồn kho của biến thể
          if (variantStock < item.quantity) {
            throw new Error(`Not enough stock for variant ID ${item.variant_id}`);
          }
          
          // Cập nhật tồn kho của biến thể
          await connection.query(
            'UPDATE variant_product SET stock = stock - ? WHERE variant_id = ?',
            [item.quantity, item.variant_id]
          );
        } else {
          // Kiểm tra tồn kho của sản phẩm
          if (stock < item.quantity) {
            throw new Error(`Not enough stock for product ID ${item.product_id}`);
          }
          
          // Cập nhật tồn kho của sản phẩm
          await connection.query(
            'UPDATE product SET stock = stock - ? WHERE product_id = ?',
            [item.quantity, item.product_id]
          );
        }
        
        // Tính giá sản phẩm (dùng giá biến thể nếu có, nếu không thì dùng giá sản phẩm)
        const itemPrice = item.variant_id && variantPrice ? variantPrice : productPrice;
        const itemTotal = itemPrice * item.quantity;
        
        // Thêm sản phẩm vào chi tiết đơn hàng
        await connection.query(`
          INSERT INTO order_items (
            order_id, product_id, variant_id, quantity, 
            unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          item.product_id,
          item.variant_id || null,
          item.quantity,
          itemPrice,
          itemTotal
        ]);
        
        subtotal += itemTotal;
        total_items += item.quantity;
      }
      
      // Xử lý mã giảm giá nếu có
      let discount = 0;
      let coupon_id = null;
      
      if (coupon_code) {
        const [couponResult] = await connection.query(`
          SELECT * FROM couponcode 
          WHERE code = ? AND is_active = 1 
          AND (expiry_date IS NULL OR expiry_date >= CURDATE())
          AND (usage_limit IS NULL OR usage_count < usage_limit)
        `, [coupon_code]);
        
        if (couponResult.length > 0) {
          const coupon = couponResult[0];
          coupon_id = coupon.coupon_id;
          
          // Tính giá trị giảm giá
          if (coupon.discount_type === 'percentage') {
            discount = subtotal * (coupon.discount_value / 100);
            // Giới hạn giảm giá tối đa nếu có
            if (coupon.max_discount && discount > coupon.max_discount) {
              discount = coupon.max_discount;
            }
          } else {
            discount = coupon.discount_value;
            // Đảm bảo giảm giá không vượt quá tổng giá trị đơn hàng
            if (discount > subtotal) {
              discount = subtotal;
            }
          }
          
          // Cập nhật số lần sử dụng mã giảm giá
          await connection.query(
            'UPDATE couponcode SET usage_count = usage_count + 1 WHERE coupon_id = ?',
            [coupon_id]
          );
        }
      }
      
      // Tính tổng tiền
      const shipping_fee = 0; // Có thể tính dựa trên địa chỉ hoặc trọng lượng
      const tax = 0; // Có thể tính dựa trên quy định thuế
      const total = subtotal - discount + shipping_fee + tax;
      
      // Cập nhật tổng tiền cho đơn hàng
      await connection.query(`
        UPDATE \`order\` SET 
          subtotal = ?,
          discount = ?,
          coupon_id = ?,
          shipping_fee = ?,
          tax = ?,
          total = ?,
          total_items = ?
        WHERE order_id = ?
      `, [
        subtotal,
        discount,
        coupon_id,
        shipping_fee,
        tax,
        total,
        total_items,
        orderId
      ]);
      
      // Commit transaction
      await connection.commit();
      
      // Lấy thông tin đơn hàng đã tạo
      const [createdOrder] = await db.query(`
        SELECT 
          o.*,
          os.order_status_name as status_name
        FROM \`order\` o
        LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
        WHERE o.order_id = ?
      `, [orderId]);
      
      // Lấy chi tiết đơn hàng
      const [orderItems] = await db.query(`
        SELECT 
          oi.*,
          p.product_name,
          p.product_image
        FROM order_items oi
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
      `, [orderId]);
      
      createdOrder[0].items = orderItems;
      
      res.status(201).json({
        message: 'Order created successfully',
        order: createdOrder[0]
      });
    } catch (error) {
      // Rollback nếu có lỗi
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
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