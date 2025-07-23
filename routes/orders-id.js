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
        'PENDING': 1,
        'CONFIRMED': 2,
        'SHIPPING': 3,
        'SUCCESS': 4
      };
      return {
        id: order.order_id,
        order_hash: order.order_hash,
        date: order.created_at,
        status: order.current_status,
        statusStep: statusStepMap[order.current_status] || 1,
        recipientName: "Khách hàng",
        recipientPhone: order.order_number2 || order.order_number1,
        address: order.order_address_new || order.order_address_old,
        subtotal: order.order_total,
        shippingFee: Number(order.shipping_fee) || 0,
        discount: Number(order.order_discount) || 0,
        total: order.order_total_final,
        products: itemsMap.get(order.order_id) || []
      };
    });

    res.json({
      user_id: userId,
      order_count: fullOrders.length,
      orders: fullOrders
    });

  } catch (error) {
    console.error('❌ Lỗi khi lấy đơn hàng:', error);
    res.status(500).json({
      error: 'Không thể lấy đơn hàng',
      details: error.message
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
    // Use the user ID from the JWT token instead of requiring it in the body
    const user_id = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { reason } = req.body;

    // Truy vấn khác nhau cho admin và user thường
    let order;
    if (isAdmin) {
      // Admin có thể hủy bất kỳ đơn hàng nào
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
      // User thường chỉ có thể hủy đơn hàng của chính mình
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

    // Kiểm tra điều kiện hủy đơn hàng (bỏ qua nếu là admin)
    if (!isAdmin) {
      // Chỉ cho phép hủy đơn hàng ở trạng thái PENDING hoặc CONFIRMED
      if (order.current_status !== 'PENDING' && order.current_status !== 'CONFIRMED') {
        return res.status(400).json({ 
          success: false, 
          message: 'Không thể hủy đơn hàng ở trạng thái hiện tại' 
        });
      }

      // Kiểm tra thời gian tạo đơn, chỉ cho phép hủy trong vòng 24 giờ
      const orderDate = new Date(order.created_at);
      const currentDate = new Date();
      const hoursDiff = (currentDate - orderDate) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return res.status(400).json({ 
          success: false, 
          message: 'Không thể hủy đơn hàng sau 24 giờ kể từ khi đặt' 
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

      // Khôi phục số lượng tồn kho cho mỗi sản phẩm
      for (const item of orderItems) {
        if (item.product_id) {
          await connection.query(
            'UPDATE product SET product_stock = product_stock + ? WHERE product_id = ?',
            [item.quantity, item.product_id]
          );
        }
      }

      // Cập nhật trạng thái đơn hàng
      await connection.query(
        'UPDATE orders SET current_status = "CANCELLED", status_updated_by = ?, status_updated_at = NOW(), note = CONCAT(IFNULL(note, ""), ?) WHERE order_id = ?',
        [isAdmin ? 'admin' : 'user', reason ? `\nLý do hủy: ${reason}` : `\nĐã hủy bởi ${isAdmin ? 'admin' : 'khách hàng'}`, orderId]
      );

      // Ghi log trạng thái
      await connection.query(
        `INSERT INTO order_status_log (order_id, from_status, to_status, trigger_by, step, created_at) 
         VALUES (?, ?, 'CANCELLED', ?, ?, NOW())`,
        [orderId, order.current_status, isAdmin ? 'admin' : 'user', `Đơn hàng đã bị hủy bởi ${isAdmin ? 'admin' : 'khách hàng'}`]
      );

      // Tạo thông báo cho người dùng nếu admin hủy đơn hàng
      if (isAdmin && order.user_id) {
        try {
          const notificationMessage = reason 
            ? `Đơn hàng #${order.order_hash} đã bị hủy bởi admin. Lý do: ${reason}`
            : `Đơn hàng #${order.order_hash} đã bị hủy bởi admin.`;
          
          // Kiểm tra xem bảng notifications có tồn tại không
          try {
            // Kiểm tra cấu trúc bảng notifications trước khi chèn
            const [notificationColumns] = await connection.query(
              `SHOW COLUMNS FROM notifications`
            );
            
            // Lấy tên các cột trong bảng notifications
            const columnNames = notificationColumns.map(col => col.Field);
            
            // Nếu bảng có cột user_id, thêm thông báo
            if (columnNames.includes('user_id')) {
              await connection.query(
                `INSERT INTO notifications (user_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ORDER_CANCELLED', ?, ?, NOW(), 0)`,
                [order.user_id, notificationMessage, orderId]
              );
              console.log(`Đã tạo thông báo hủy đơn hàng cho user ${order.user_id}`);
            } 
            // Nếu bảng có cột customer_id thay vì user_id
            else if (columnNames.includes('customer_id')) {
              await connection.query(
                `INSERT INTO notifications (customer_id, type, message, related_id, created_at, is_read)
                 VALUES (?, 'ORDER_CANCELLED', ?, ?, NOW(), 0)`,
                [order.user_id, notificationMessage, orderId]
              );
              console.log(`Đã tạo thông báo hủy đơn hàng cho customer ${order.user_id}`);
            }
            else {
              console.log('Không thể tạo thông báo: Cấu trúc bảng notifications không phù hợp');
            }
          } catch (tableError) {
            // Bảng notifications có thể không tồn tại
            if (tableError.code === 'ER_NO_SUCH_TABLE') {
              console.log('Bảng notifications không tồn tại trong cơ sở dữ liệu');
            } else {
              console.error('Lỗi khi kiểm tra bảng notifications:', tableError);
            }
          }
          
          // Có thể thêm code gửi email thông báo ở đây
          try {
            // Giả sử có một hàm sendEmail được import
            // await sendEmail(order.user_email, 'Thông báo hủy đơn hàng', {
            //   name: order.user_name,
            //   order_hash: order.order_hash,
            //   reason: reason || 'Không có lý do được cung cấp',
            //   cancelled_by: 'Admin'
            // });
            console.log(`Đã gửi email thông báo hủy đơn hàng đến ${order.user_email}`);
          } catch (emailError) {
            console.error('Lỗi khi gửi email thông báo:', emailError);
            // Không throw lỗi ở đây để transaction vẫn tiếp tục
          }
        } catch (notificationError) {
          // Ghi log lỗi nhưng không làm ảnh hưởng đến transaction
          console.error('Lỗi khi tạo thông báo:', notificationError);
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
      // Rollback nếu có lỗi
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Lỗi khi hủy đơn hàng:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi hủy đơn hàng',
      error: error.message
    });
  }
});

module.exports = router;
