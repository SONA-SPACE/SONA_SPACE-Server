const express = require('express');
const router = express.Router();
const db = require('../config/database');

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



module.exports = router;
