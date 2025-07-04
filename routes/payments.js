const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/payments
 * @desc    Lấy danh sách thanh toán
 * @access  Private (Admin only)
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Lấy tổng số thanh toán
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM payment');
    const totalPayments = countResult[0].total;
    const totalPages = Math.ceil(totalPayments / limit);

    // Lấy danh sách thanh toán
    const [payments] = await db.query(`
      SELECT 
        p.*,
        o.order_hash,
        u.user_name,
        u.user_gmail as user_email
      FROM payment p
      LEFT JOIN \`order\` o ON p.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      ORDER BY p.created_at DESC
      LIMIT ?, ?
    `, [offset, limit]);

    res.json({
      payments,
      pagination: {
        currentPage: page,
        totalPages,
        totalPayments,
        paymentsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * @route   GET /api/payments/:id
 * @desc    Lấy thông tin một thanh toán
 * @access  Private
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const [payments] = await db.query(`
      SELECT 
        p.*,
        o.order_hash,
        o.order_total as order_total,
        u.user_name,
        u.user_gmail as user_email
      FROM payment p
      LEFT JOIN \`order\` o ON p.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      WHERE p.payment_id = ?
    `, [id]);

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];

    // Kiểm tra quyền truy cập
    if (!req.user.isAdmin && req.user.id !== payment.user_id) {
      return res.status(403).json({ error: 'Unauthorized access to payment information' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

/**
 * @route   GET /api/payments/order/:orderId
 * @desc    Lấy thanh toán theo đơn hàng
 * @access  Private
 */
router.get('/order/:orderId', verifyToken, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Lấy thông tin đơn hàng
    const [orders] = await db.query('SELECT * FROM \`order\` WHERE order_id = ?', [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Kiểm tra quyền truy cập
    if (!req.user.isAdmin && req.user.id !== order.user_id) {
      return res.status(403).json({ error: 'Unauthorized access to order payment information' });
    }

    // Lấy các thanh toán của đơn hàng
    const [payments] = await db.query('SELECT * FROM payment WHERE order_id = ? ORDER BY created_at DESC', [orderId]);

    res.json({
      order_id: orderId,
      order_hash: order.order_hash,
      payments
    });
  } catch (error) {
    console.error('Error fetching order payments:', error);
    res.status(500).json({ error: 'Failed to fetch order payments' });
  }
});

/**
 * @route   POST /api/payments
 * @desc    Tạo thanh toán mới
 * @access  Private
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      order_id,
      amount,
      payment_method,
      transaction_id,
      payment_status, // expected: 'completed' | 'pending'
      payment_details
    } = req.body;

    if (!order_id || !amount || !payment_method) {
      return res.status(400).json({ error: 'Order ID, amount and payment method are required' });
    }

    // Kiểm tra đơn hàng tồn tại
    const [orders] = await db.query('SELECT * FROM `order` WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Kiểm tra quyền truy cập
    if (!req.user.isAdmin && req.user.id !== order.user_id) {
      return res.status(403).json({ error: 'Unauthorized access to create payment for this order' });
    }

    // Lấy tổng tiền đã thanh toán trước đó
    const [existingPayments] = await db.query(
      'SELECT SUM(amount) as paid FROM payment WHERE order_id = ? AND payment_status = "completed"',
      [order_id]
    );
    const paidAmount = existingPayments[0].paid || 0;
    const remainingAmount = order.order_total - paidAmount;

    if (payment_status === 'completed' && amount > remainingAmount) {
      return res.status(400).json({
        error: 'Payment amount exceeds remaining balance',
        orderTotal: order.order_total,
        paidAmount,
        remainingAmount
      });
    }

    // ✅ Ghi thanh toán mới
    const [result] = await db.query(
      `INSERT INTO payment (
        order_id, 
        amount, 
        payment_method, 
        transaction_id, 
        payment_status, 
        payment_details,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        order_id,
        amount,
        payment_method,
        transaction_id || null,
        payment_status || 'pending',
        payment_details ? JSON.stringify(payment_details) : null
      ]
    );

    const [newPayment] = await db.query('SELECT * FROM payment WHERE payment_id = ?', [result.insertId]);

    // ✅ Cập nhật trạng thái đơn hàng nếu cần
    if (payment_status === 'completed') {
      const [updatedPayments] = await db.query(
        'SELECT SUM(amount) as paid FROM payment WHERE order_id = ? AND payment_status = "completed"',
        [order_id]
      );
      const totalPaid = updatedPayments[0].paid || 0;

      let paymentStatus = 'unpaid';
      if (totalPaid >= order.order_total) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partially_paid';
      }

      // ✅ Nếu là thanh toán COD thì đơn hàng đã trả đủ ngay
      // ✅ Nếu là MOMO / VNPAY thanh toán completed cũng là trả đủ
      const currentStatus = 'PENDING';

      await db.query(
        'UPDATE `order` SET payment_status = ?, current_status = ? WHERE order_id = ?',
        [paymentStatus, currentStatus, order_id]
      );
    }

    return res.status(201).json({
      message: 'Payment created successfully',
      payment: newPayment[0]
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
});


/**
 * @route   PUT /api/payments/:id
 * @desc    Cập nhật thông tin thanh toán
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const { transaction_id, payment_status, payment_details } = req.body;

    // Kiểm tra thanh toán tồn tại
    const [payments] = await db.query('SELECT * FROM payment WHERE payment_id = ?', [id]);
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];

    // Cập nhật thanh toán
    const updates = [];
    const values = [];

    if (transaction_id !== undefined) {
      updates.push('transaction_id = ?');
      values.push(transaction_id);
    }

    if (payment_status !== undefined) {
      updates.push('payment_status = ?');
      values.push(payment_status);
    }

    if (payment_details !== undefined) {
      updates.push('payment_details = ?');
      values.push(JSON.stringify(payment_details));
    }

    updates.push('updated_at = NOW()');

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    values.push(id);

    await db.query(
      `UPDATE payment SET ${updates.join(', ')} WHERE payment_id = ?`,
      values
    );

    // Lấy thông tin thanh toán đã cập nhật
    const [updatedPayment] = await db.query('SELECT * FROM payment WHERE payment_id = ?', [id]);

    // Nếu trạng thái thanh toán thay đổi, cập nhật trạng thái đơn hàng
    if (payment_status !== undefined && payment_status !== payment.payment_status) {
      const orderId = payment.order_id;

      // Lấy đơn hàng
      const [orders] = await db.query('SELECT * FROM \`order\` WHERE order_id = ?', [orderId]);
      if (orders.length > 0) {
        const order = orders[0];

        // Tính lại tổng số tiền đã thanh toán
        const [updatedPayments] = await db.query('SELECT SUM(amount) as paid FROM payment WHERE order_id = ? AND payment_status = "completed"', [orderId]);
        const totalPaid = updatedPayments[0].paid || 0;

        // Cập nhật trạng thái thanh toán của đơn hàng
        let paymentStatus = 'unpaid';
        if (totalPaid >= order.order_total) {
          paymentStatus = 'paid';
        } else if (totalPaid > 0) {
          paymentStatus = 'partially_paid';
        }

        await db.query('UPDATE \`order\` SET payment_status = ? WHERE order_id = ?', [paymentStatus, orderId]);
      }
    }

    res.json({
      message: 'Payment updated successfully',
      payment: updatedPayment[0]
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

/**
 * @route   DELETE /api/payments/:id
 * @desc    Xóa thanh toán
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    // Kiểm tra thanh toán tồn tại
    const [payments] = await db.query('SELECT * FROM payment WHERE payment_id = ?', [id]);
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];
    const orderId = payment.order_id;

    // Xóa thanh toán
    await db.query('DELETE FROM payment WHERE payment_id = ?', [id]);

    // Cập nhật trạng thái đơn hàng
    // Lấy đơn hàng
    const [orders] = await db.query('SELECT * FROM \`order\` WHERE order_id = ?', [orderId]);
    if (orders.length > 0) {
      const order = orders[0];

      // Tính lại tổng số tiền đã thanh toán
      const [updatedPayments] = await db.query('SELECT SUM(amount) as paid FROM payment WHERE order_id = ? AND payment_status = "completed"', [orderId]);
      const totalPaid = updatedPayments[0].paid || 0;

      // Cập nhật trạng thái thanh toán của đơn hàng
      let paymentStatus = 'unpaid';
      if (totalPaid >= order.order_total) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partially_paid';
      }

      await db.query('UPDATE \`order\` SET payment_status = ? WHERE order_id = ?', [paymentStatus, orderId]);
    }

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

module.exports = router; 