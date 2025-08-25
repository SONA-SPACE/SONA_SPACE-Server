const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth'); // Add this line to import authentication middleware

/**
 * @route   GET /api/orders-id/:userId
 * @desc    Lấy thông tin đơn hàng của user theo user_id (Public API)
 * @access  Public
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Thiếu user ID' });
    }

    // Truy vấn tất cả đơn hàng của user (có đầy đủ thông tin từ bảng orders)
    const [orders] = await db.query(`
      SELECT
        o.order_id,
        o.order_hash,
        o.created_at,
        o.current_status,
        o.order_address_old,
        o.order_address_new,
        o.order_number1,
        o.order_number2,
        o.order_total,
        o.order_total_final,
        o.shipping_fee,
        o.order_discount
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [userId]);

    if (orders.length === 0) {
      return res.json({
        message: 'Không có đơn hàng nào',
        orders: []
      });
    }

    // Lấy toàn bộ order_id
    const orderIds = orders.map(o => o.order_id);

    // Lấy thông tin hủy/trả đơn hàng từ bảng order_returns cho các đơn hàng có trạng thái CANCELLED hoặc RETURN
    const cancelledOrReturnOrderIds = orders.filter(o => o.current_status === 'CANCELLED' || o.current_status === 'RETURN').map(o => o.order_id);
    let orderReturnsMap = new Map();
    
    if (cancelledOrReturnOrderIds.length > 0) {
      const [orderReturns] = await db.query(`
        SELECT 
          order_id,
          return_id,
          reason,
          return_type,
          total_refund,
          status as return_status,
          created_at as return_created_at,
          updated_at as return_updated_at
        FROM order_returns 
        WHERE order_id IN (?)
        ORDER BY created_at DESC
      `, [cancelledOrReturnOrderIds]);

      // Tạo map để tra cứu nhanh thông tin return theo order_id
      for (const returnInfo of orderReturns) {
        if (!orderReturnsMap.has(returnInfo.order_id)) {
          orderReturnsMap.set(returnInfo.order_id, returnInfo);
        }
      }
    }

    // Lấy sản phẩm chi tiết trong tất cả đơn hàng theo order_id
    const [items] = await db.query(`
      SELECT 
        oi.order_id,
        oi.order_item_id AS id,
        oi.quantity,
        vp.variant_id,
        vp.variant_product_price AS price,
        vp.variant_product_price_sale AS price_sale,
        vp.variant_product_list_image AS image,
        c.color_name,
        c.color_hex,
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_image AS product_image,
        cat.category_name AS category,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) AS comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) AS average_rating
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      WHERE oi.order_id IN (?)
    `, [orderIds]);

    // Gom sản phẩm theo order_id
    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.order_id)) {
        itemsMap.set(item.order_id, []);
      }

      itemsMap.get(item.order_id).push({
        id: item.id,
        name: item.product_name,
        slug: item.product_slug,
        image: item.image || item.product_image || '/images/default.jpg',
        price: item.price_sale || item.price,
        quantity: item.quantity,
        color: {
          name: item.color_name,
          hex: item.color_hex
        },
        category: item.category,
        rating: {
          count: item.comment_count,
          average: item.average_rating
        }
      });
    }

    // Gắn sản phẩm vào từng đơn hàng
    const fullOrders = orders.map(order => {
      const statusStepMap = {
        // Quy trình đặt hàng thành công
        'PENDING': 1,
        'APPROVED': 2,
        'CONFIRMED': 2, // Tương đương với APPROVED
        'SHIPPING': 3,
        'COMPLETED': 4,
        'SUCCESS': 4, // Tương đương với COMPLETED
        
        // Quy trình hủy đơn hàng (từ bảng order_returns)
        'CANCEL_REQUESTED': 1, // Khách hàng yêu cầu hủy
        'CANCEL_PENDING': 2,   // Đang chờ xử lý hủy
        'CANCEL_CONFIRMED': 3, // Xác nhận hủy
        'CANCELLED': 4,        // Đã hủy hoàn tất
        
        // Quy trình trả hàng
        'RETURN': 4,           // Đã trả hàng hoàn tất
        
        // Quy trình từ chối/thất bại
        'REJECTED': 1,         // Đơn hàng bị từ chối
        'FAILED': 1            // Đơn hàng thất bại
      };

      // Xác định loại quy trình và step dựa trên trạng thái
      let processType = 'normal'; // Quy trình bình thường
      let actualStatus = order.current_status;
      let statusStep = statusStepMap[order.current_status] || 1;
      let returnInfo = null;

      // Kiểm tra xem đơn hàng có trong bảng order_returns không
      if ((order.current_status === 'CANCELLED' || order.current_status === 'RETURN') && orderReturnsMap.has(order.order_id)) {
        returnInfo = orderReturnsMap.get(order.order_id);
        
        if (order.current_status === 'CANCELLED') {
          processType = 'cancellation';
        } else if (order.current_status === 'RETURN') {
          processType = 'return';
        }
        
        actualStatus = returnInfo.return_status;
        statusStep = statusStepMap[returnInfo.return_status] || statusStepMap[order.current_status] || 4;
      } else if (['REJECTED', 'FAILED'].includes(order.current_status)) {
        processType = 'failed';
      }

      const result = {
        id: order.order_id,
        order_hash: order.order_hash,
        date: order.created_at,
        status: order.current_status,
        statusStep: statusStep,
        processType: processType, // Thêm thông tin loại quy trình
        recipientName: "Khách hàng",
        recipientPhone: order.order_number2 || order.order_number1,
        address: order.order_address_new || order.order_address_old,
        subtotal: order.order_total,
        shippingFee: Number(order.shipping_fee) || 0,
        discount: Number(order.order_discount) || 0,
        total: order.order_total_final,
        products: itemsMap.get(order.order_id) || []
      };

      // Thêm thông tin return nếu có
      if (returnInfo) {
        result.returnInfo = {
          return_id: returnInfo.return_id,
          reason: returnInfo.reason,
          return_type: returnInfo.return_type,
          total_refund: returnInfo.total_refund,
          return_status: returnInfo.return_status,
          return_created_at: returnInfo.return_created_at,
          return_updated_at: returnInfo.return_updated_at
        };
      }

      return result;
    });

    res.json({
      user_id: userId,
      order_count: fullOrders.length,
      orders: fullOrders
    });

  } catch (error) {
    res.status(500).json({
      error: 'Không thể lấy đơn hàng',
      details: error.message
    });
  }
});

/**
 * @route   PUT /api/orders-id/cancel-item/:orderId/:itemId
 * @desc    Hủy một sản phẩm cụ thể trong đơn hàng (không hủy toàn bộ đơn hàng)
 * @access  Private
 */
router.put('/cancel-item/:orderId/:itemId', verifyToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const itemId = req.params.itemId; // order_item_id
    const user_id = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { reason } = req.body;

    // Lấy thông tin đơn hàng và sản phẩm cần hủy
    let orderQuery;
    let params;
    
    if (isAdmin) {
      orderQuery = `
        SELECT o.order_id, o.user_id, o.current_status, o.created_at, o.order_hash, o.order_total_final,
               u.user_name, u.user_gmail as user_email,
               oi.order_item_id, oi.variant_id, oi.quantity, oi.product_price, oi.current_status as item_status,
               p.product_name, p.product_id
        FROM orders o
        LEFT JOIN user u ON o.user_id = u.user_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        WHERE o.order_id = ? AND oi.order_item_id = ?`;
      params = [orderId, itemId];
    } else {
      orderQuery = `
        SELECT o.order_id, o.user_id, o.current_status, o.created_at, o.order_hash, o.order_total_final,
               u.user_name, u.user_gmail as user_email,
               oi.order_item_id, oi.variant_id, oi.quantity, oi.product_price, oi.current_status as item_status,
               p.product_name, p.product_id
        FROM orders o
        LEFT JOIN user u ON o.user_id = u.user_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        WHERE o.order_id = ? AND oi.order_item_id = ? AND o.user_id = ?`;
      params = [orderId, itemId, user_id];
    }

    const [[orderItem]] = await db.query(orderQuery, params);

    if (!orderItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy sản phẩm trong đơn hàng hoặc bạn không có quyền hủy sản phẩm này' 
      });
    }

    // Kiểm tra trạng thái sản phẩm
    if (orderItem.item_status !== 'NORMAL') {
      return res.status(400).json({ 
        success: false, 
        message: `Sản phẩm đã ở trạng thái: ${orderItem.item_status}. Không thể hủy.` 
      });
    }

    // Kiểm tra điều kiện hủy nếu không phải admin
    if (!isAdmin) {
      if (orderItem.current_status !== 'PENDING' && orderItem.current_status !== 'CONFIRMED') {
        return res.status(400).json({ 
          success: false, 
          message: `Không thể hủy sản phẩm khi đơn hàng ở trạng thái: ${orderItem.current_status}. Chỉ có thể hủy sản phẩm khi đơn hàng ở trạng thái PENDING hoặc CONFIRMED.` 
        });
      }

      const orderDate = new Date(orderItem.created_at);
      const currentDate = new Date();
      const hoursDiff = (currentDate - orderDate) / (1000 * 60 * 60);
      if (hoursDiff > 72) {
        return res.status(400).json({ 
          success: false, 
          message: `Không thể hủy sản phẩm sau 72 giờ kể từ khi đặt. Đơn hàng này đã được tạo ${hoursDiff.toFixed(1)} giờ trước.` 
        });
      }
    }

    // Bắt đầu transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Cập nhật trạng thái sản phẩm trong order_items
      await connection.query(
        `UPDATE order_items 
         SET current_status = 'RETURN_REQUESTED', 
             updated_at = NOW() 
         WHERE order_item_id = ?`,
        [itemId]
      );

      // Cập nhật kho biến thể sản phẩm (cộng lại số lượng đã hủy)
      if (orderItem.variant_id) {
        await connection.query(
          `UPDATE variant_product
           SET variant_product_quantity = variant_product_quantity + ?
           WHERE variant_id = ?`,
          [orderItem.quantity, orderItem.variant_id]
        );
        console.log("Updated variant_product_quantity for variant_id:", orderItem.variant_id);
      }

      // Giảm số lượng đã bán của sản phẩm
      if (orderItem.product_id) {
        await connection.query(
          `UPDATE product
           SET product_sold = GREATEST(product_sold - ?, 0)
           WHERE product_id = ?`,
          [orderItem.quantity, orderItem.product_id]
        );
      }

      // Tính toán lại tổng tiền đơn hàng
      const itemTotal = Number(orderItem.product_price) * Number(orderItem.quantity);
      
      // Cập nhật tổng tiền đơn hàng (trừ đi giá trị sản phẩm đã hủy)
      await connection.query(
        `UPDATE orders 
         SET order_total = order_total - ?,
             order_total_final = order_total_final - ?,
             updated_at = NOW(),
             note = CONCAT(IFNULL(note, ''), ?)
         WHERE order_id = ?`,
        [
          itemTotal, 
          itemTotal, 
          `\nĐã hủy sản phẩm: ${orderItem.product_name} (${orderItem.quantity} x ${Number(orderItem.product_price).toLocaleString('vi-VN')}đ) - Lý do: ${reason || 'Không có lý do'}`, 
          orderId
        ]
      );

      // Tạo bản ghi trong order_returns cho sản phẩm bị hủy
      const returnReason = reason || (isAdmin ? `Sản phẩm "${orderItem.product_name}" đã bị hủy bởi admin` : `Sản phẩm "${orderItem.product_name}" đã được hủy bởi khách hàng`);
      
      await connection.query(
        `INSERT INTO order_returns (
          order_id, user_id, reason, return_type, total_refund, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'REFUND', ?, 'COMPLETED', NOW(), NOW())`,
        [orderId, orderItem.user_id, returnReason, itemTotal]
      );

      // Ghi log cho việc hủy sản phẩm
      await connection.query(
        `INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) 
         VALUES (?, 'NORMAL', 'ITEM_CANCELLED', ?, ?, NOW())`,
        [orderId, isAdmin ? 'admin' : 'user', `Hủy sản phẩm: ${orderItem.product_name} (ID: ${itemId})`]
      );

      // Kiểm tra xem còn sản phẩm nào trong đơn hàng không
      const [[remainingItems]] = await connection.query(
        `SELECT COUNT(*) as count FROM order_items WHERE order_id = ? AND current_status = 'NORMAL'`,
        [orderId]
      );

      let orderStatusMessage = '';
      if (remainingItems.count === 0) {
        // Nếu không còn sản phẩm nào, hủy toàn bộ đơn hàng
        await connection.query(
          `UPDATE orders 
           SET current_status = 'CANCELLED',
               status_updated_by = ?,
               status_updated_at = NOW(),
               note = CONCAT(IFNULL(note, ''), ?)
           WHERE order_id = ?`,
          [isAdmin ? 'admin' : 'user', '\nĐơn hàng đã được hủy hoàn toàn do tất cả sản phẩm đều bị hủy.', orderId]
        );
        orderStatusMessage = ' Đơn hàng đã được hủy hoàn toàn do không còn sản phẩm nào.';
      }

      // Tạo thông báo nếu admin hủy sản phẩm
      if (isAdmin && orderItem.user_id) {
        try {
          const notificationMessage = reason 
            ? `Sản phẩm "${orderItem.product_name}" trong đơn hàng #${orderItem.order_hash} đã bị hủy bởi admin. Lý do: ${reason}`
            : `Sản phẩm "${orderItem.product_name}" trong đơn hàng #${orderItem.order_hash} đã bị hủy bởi admin.`;

          // Kiểm tra cấu trúc bảng notifications và chèn thông báo
          try {
            const [notificationColumns] = await connection.query(`SHOW COLUMNS FROM notifications`);
            const columnNames = notificationColumns.map(col => col.Field);

            if (columnNames.includes('user_id')) {
              await connection.query(
                `INSERT INTO notifications (user_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ITEM_CANCELLED', ?, ?, NOW(), 0)`,
                [orderItem.user_id, notificationMessage, orderId]
              );
            } else if (columnNames.includes('customer_id')) {
              await connection.query(
                `INSERT INTO notifications (customer_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ITEM_CANCELLED', ?, ?, NOW(), 0)`,
                [orderItem.user_id, notificationMessage, orderId]
              );
            }
          } catch (tableError) {
            console.log('Không thể tạo thông báo:', tableError.message);
          }

        } catch (notificationError) {
          console.error('Lỗi khi tạo thông báo:', notificationError);
        }
      }

      // Commit transaction
      await connection.commit();

      return res.status(200).json({
        success: true,
        message: `Hủy sản phẩm "${orderItem.product_name}" thành công.${orderStatusMessage}`,
        data: {
          order_id: orderId,
          order_hash: orderItem.order_hash,
          cancelled_item: {
            item_id: itemId,
            product_name: orderItem.product_name,
            quantity: orderItem.quantity,
            refund_amount: itemTotal
          },
          remaining_items: remainingItems.count
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi hủy sản phẩm',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/orders-id/cancel
 * @desc    Handle case when no order ID is provided
 * @access  Private
 */
router.put('/cancel', verifyToken, (req, res) => {
  return res.status(400).json({ 
    success: false, 
    message: 'Thiếu ID đơn hàng. Vui lòng cung cấp ID đơn hàng cần hủy trong đường dẫn.' 
  });
});

/**
 * @route   PUT /api/orders-id/cancel/:orderId
 * @desc    Hủy đơn hàng bằng cách đổi trạng thái current_status sang CANCELLED
 * @access  Private
 */
router.put('/cancel/:orderId', verifyToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const user_id = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { reason } = req.body;

    // Lấy đơn hàng theo quyền: admin hoặc user thường
    let order;
    if (isAdmin) {
      const [[adminOrder]] = await db.query(
        `SELECT o.order_id, o.user_id, o.current_status, o.created_at, o.order_hash, 
         u.user_name, u.user_gmail as user_email
         FROM orders o
         LEFT JOIN user u ON o.user_id = u.user_id
         WHERE o.order_id = ?`,
        [orderId]
      );
      order = adminOrder;
    } else {
      const [[userOrder]] = await db.query(
        `SELECT o.order_id, o.user_id, o.current_status, o.created_at, o.order_hash, 
         u.user_name, u.user_gmail as user_email
         FROM orders o
         LEFT JOIN user u ON o.user_id = u.user_id
         WHERE o.order_id = ? AND o.user_id = ?`,
        [orderId, user_id]
      );
      order = userOrder;
    }

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn hàng này' 
      });
    }

    // Kiểm tra điều kiện hủy nếu không phải admin
    if (!isAdmin) {
      if (order.current_status !== 'PENDING' && order.current_status !== 'CONFIRMED') {
        return res.status(400).json({ 
          success: false, 
          message: `Không thể hủy đơn hàng ở trạng thái hiện tại: ${order.current_status}. Chỉ có thể hủy đơn hàng ở trạng thái PENDING hoặc CONFIRMED.` 
        });
      }

      const orderDate = new Date(order.created_at);
      const currentDate = new Date();
      const hoursDiff = (currentDate - orderDate) / (1000 * 60 * 60);
      if (hoursDiff > 72) {
        return res.status(400).json({ 
          success: false, 
          message: `Không thể hủy đơn hàng sau 72 giờ kể từ khi đặt. Đơn hàng này đã được tạo ${hoursDiff.toFixed(1)} giờ trước.` 
        });
      }
    }

    // Bắt đầu transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Lấy danh sách sản phẩm trong đơn hàng
      const [orderItems] = await connection.query(
        `SELECT oi.variant_id, oi.quantity, vp.product_id 
         FROM order_items oi
         LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
         WHERE oi.order_id = ?`,
        [orderId]
      );

      // Cập nhật kho và số lượng bán khi hủy đơn (trạng thái CANCELLED)
      for (const item of orderItems) {
        if (item.variant_id) {
          // Cộng lại kho biến thể sản phẩm
          await connection.query(
            `UPDATE variant_product
             SET variant_product_quantity = variant_product_quantity + ?
             WHERE variant_id = ?`,
            [item.quantity, item.variant_id]
          );
          console.log("Updated variant_product_quantity for variant_id:", item.variant_id);
        }
        if (item.product_id) {
          // Giảm số lượng đã bán của sản phẩm, không để âm
          await connection.query(
            `UPDATE product
             SET product_sold = GREATEST(product_sold - ?, 0)
             WHERE product_id = ?`,
            [item.quantity, item.product_id]
          );
        }
      }

      // Cập nhật trạng thái đơn hàng sang CANCELLED
      await connection.query(
        `UPDATE orders 
         SET current_status = "CANCELLED", 
             status_updated_by = ?, 
             status_updated_at = NOW(), 
             note = CONCAT(IFNULL(note, ""), ?) 
         WHERE order_id = ?`,
        [isAdmin ? 'admin' : 'user', reason ? `\nLý do hủy: ${reason}` : `\nĐã hủy bởi ${isAdmin ? 'admin' : 'khách hàng'}`, orderId]
      );

      // Tạo bản ghi hủy đơn hàng trong order_returns
      const returnReason = reason || (isAdmin ? 'Đơn hàng đã bị hủy bởi admin' : 'Đơn hàng đã được hủy bởi khách hàng');
      const returnStatus = 'CANCELLED';

      await connection.query(
        `INSERT INTO order_returns (
          order_id, user_id, reason, return_type, total_refund, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'DENY', 0.00, ?, NOW(), NOW())`,
        [orderId, order.user_id, returnReason, returnStatus]
      );

      // Ghi log trạng thái hủy đơn
      await connection.query(
        `INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) 
         VALUES (?, ?, 'CANCELLED', ?, ?, NOW())`,
        [orderId, order.current_status, isAdmin ? 'admin' : 'user', `Đơn hàng đã bị hủy bởi ${isAdmin ? 'admin' : 'khách hàng'}`]
      );

      // Tạo thông báo nếu admin hủy đơn hàng
      if (isAdmin && order.user_id) {
        try {
          const notificationMessage = reason 
            ? `Đơn hàng #${order.order_hash} đã bị hủy bởi admin. Lý do: ${reason}`
            : `Đơn hàng #${order.order_hash} đã bị hủy bởi admin.`;

          // Kiểm tra cấu trúc bảng notifications và chèn thông báo
          try {
            const [notificationColumns] = await connection.query(`SHOW COLUMNS FROM notifications`);
            const columnNames = notificationColumns.map(col => col.Field);

            if (columnNames.includes('user_id')) {
              await connection.query(
                `INSERT INTO notifications (user_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ORDER_CANCELLED', ?, ?, NOW(), 0)`,
                [order.user_id, notificationMessage, orderId]
              );
            } else if (columnNames.includes('customer_id')) {
            } 
            // Nếu bảng có cột customer_id thay vì user_id
            else if (columnNames.includes('customer_id')) {
              await connection.query(
                `INSERT INTO notifications (customer_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ORDER_CANCELLED', ?, ?, NOW(), 0)`,
                [order.user_id, notificationMessage, orderId]
              );
            } else {
              console.log('Không thể tạo thông báo: Cấu trúc bảng notifications không phù hợp');
            }
          } catch (tableError) {
            if (tableError.code === 'ER_NO_SUCH_TABLE') {
            } else {
            }
          }

          // Gửi email thông báo (nếu cần)
          try {
            // await sendEmail(order.user_email, 'Thông báo hủy đơn hàng', {
            //   name: order.user_name,
            //   order_hash: order.order_hash,
            //   reason: reason || 'Không có lý do được cung cấp',
            //   cancelled_by: 'Admin'
            // });
          } catch (emailError) {
            console.error('Lỗi khi gửi email thông báo:', emailError);
            // Không throw lỗi ở đây để transaction vẫn tiếp tục
          }

        } catch (notificationError) {
          console.error('Lỗi khi tạo thông báo:', notificationError);
          // Ghi log lỗi nhưng không làm ảnh hưởng đến transaction
          // Không throw lỗi để transaction vẫn tiếp tục
        }
      }

      // Commit transaction
      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Hủy đơn hàng thành công',
        order_id: orderId,
        order_hash: order.order_hash
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi hủy đơn hàng',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/orders-id/items/:orderId
 * @desc    Lấy danh sách sản phẩm trong đơn hàng cụ thể
 * @access  Private
 */
router.get('/items/:orderId', verifyToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const user_id = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Kiểm tra quyền truy cập đơn hàng
    let orderQuery;
    let params;
    
    if (isAdmin) {
      orderQuery = `SELECT order_id, order_hash, current_status FROM orders WHERE order_id = ?`;
      params = [orderId];
    } else {
      orderQuery = `SELECT order_id, order_hash, current_status FROM orders WHERE order_id = ? AND user_id = ?`;
      params = [orderId, user_id];
    }

    const [[order]] = await db.query(orderQuery, params);

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập' 
      });
    }

    // Lấy danh sách sản phẩm trong đơn hàng
    const [items] = await db.query(`
      SELECT 
        oi.order_item_id,
        oi.quantity,
        oi.product_price,
        oi.current_status as item_status,
        oi.created_at,
        oi.updated_at,
        vp.variant_id,
        vp.variant_product_price AS variant_price,
        vp.variant_product_price_sale AS variant_price_sale,
        vp.variant_product_list_image AS variant_image,
        c.color_name,
        c.color_hex,
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_image,
        cat.category_name AS category
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `, [orderId]);

    // Format dữ liệu trả về
    const formattedItems = items.map(item => ({
      item_id: item.order_item_id,
      variant_id: item.variant_id,
      product: {
        id: item.product_id,
        name: item.product_name,
        slug: item.product_slug,
        image: item.variant_image || item.product_image,
        category: item.category
      },
      color: {
        name: item.color_name,
        hex: item.color_hex
      },
      quantity: item.quantity,
      price: Number(item.product_price),
      item_total: Number(item.product_price) * Number(item.quantity),
      status: item.item_status,
      can_cancel: item.item_status === 'NORMAL' && ['PENDING', 'CONFIRMED'].includes(order.current_status),
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    // Tính tổng giá trị các sản phẩm còn lại
    const activeItems = formattedItems.filter(item => item.status === 'NORMAL');
    const totalValue = activeItems.reduce((sum, item) => sum + item.item_total, 0);

    return res.status(200).json({
      success: true,
      data: {
        order: {
          id: order.order_id,
          hash: order.order_hash,
          status: order.current_status
        },
        items: formattedItems,
        summary: {
          total_items: formattedItems.length,
          active_items: activeItems.length,
          cancelled_items: formattedItems.filter(item => item.status !== 'NORMAL').length,
          total_value: totalValue
        }
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách sản phẩm',
      error: error.message
    });
  }
});

module.exports = router;
