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
      return res.status(400).json({ error: 'Missing user ID' });
    }

    // Lấy danh sách đơn hàng của user với thông tin sản phẩm
    const [orderItems] = await db.query(`
      SELECT 
        o.order_id,
        o.created_at,
        os.order_status_name,
        oi.product_id,
        p.product_name,
        p.product_image,
        oi.product_price,
        oi.variant_id,
        oi.quantity
      FROM \`order\` o
      JOIN \`order_items\` oi ON o.order_id = oi.order_id
      JOIN \`product\` p ON oi.product_id = p.product_id
      LEFT JOIN \`order_status\` os ON o.order_status_id = os.order_status_id
      WHERE o.user_id = ?
      ORDER BY o.order_id DESC
    `, [userId]);

    if (orderItems.length === 0) {
      return res.json({ 
        message: 'No orders found for this user',
        orders: []
      });
    }

    // Nhóm các sản phẩm theo order_id
    const orderMap = new Map();
    
    orderItems.forEach(item => {
      if (!orderMap.has(item.order_id)) {
        orderMap.set(item.order_id, {
          order_id: item.order_id,
          created_at: item.created_at,
          order_status_name: item.order_status_name,
          items: []
        });
      }
      
      orderMap.get(item.order_id).items.push({
        product_id: item.product_id,
        product_name: item.product_name,
        product_image: item.product_image,
        product_price: item.product_price,
        variant_id: item.variant_id,
        quantity: item.quantity
      });
    });
    
    // Chuyển đổi Map thành mảng orders
    const orders = Array.from(orderMap.values());

    res.json({
      user_id: userId,
      order_count: orders.length,
      orders: orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error.message
    });
  }
});

module.exports = router;
