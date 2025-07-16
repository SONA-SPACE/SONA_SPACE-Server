const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/order-status
 * @desc    Lấy danh sách trạng thái đơn hàng
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    console.log('Fetching order statuses...');
    const [statuses] = await db.query('SELECT * FROM order_status ORDER BY order_status_id ASC');
    res.json(statuses);
  } catch (error) {
    console.error('Error fetching order statuses:', error);
    res.status(500).json({ error: 'Failed to fetch order statuses' });
  }
});

/**
 * @route   GET /api/order-status/:id
 * @desc    Lấy thông tin một trạng thái đơn hàng
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const statusId = Number(req.params.id);
    if (isNaN(statusId)) {
      return res.status(400).json({ error: 'Invalid status ID' });
    }

    const [statuses] = await db.query('SELECT * FROM order_status WHERE order_status_id = ?', [statusId]);
    
    if (statuses.length === 0) {
      return res.status(404).json({ error: 'Order status not found' });
    }
    
    res.json(statuses[0]);
  } catch (error) {
    console.error('Error fetching order status:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

/**
 * @route   POST /api/order-status
 * @desc    Tạo trạng thái đơn hàng mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Status name is required' });
    }
    
    // Kiểm tra tên trạng thái đã tồn tại chưa
    const [existingStatuses] = await db.query('SELECT order_status_id FROM order_status WHERE order_status_name = ?', [name]);
    
    if (existingStatuses.length > 0) {
      return res.status(400).json({ error: 'Status name already exists' });
    }
    
    const [result] = await db.query(
      'INSERT INTO order_status (order_status_name, order_status_color) VALUES (?, ?)',
      [name, color || '#808080']
    );
    
    const [newStatus] = await db.query('SELECT * FROM order_status WHERE order_status_id = ?', [result.insertId]);
    
    res.status(201).json({
      message: 'Order status created successfully',
      status: newStatus[0]
    });
  } catch (error) {
    console.error('Error creating order status:', error);
    res.status(500).json({ error: 'Failed to create order status' });
  }
});

/**
 * @route   PUT /api/order-status/:id
 * @desc    Cập nhật thông tin trạng thái đơn hàng
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const statusId = Number(req.params.id);
    if (isNaN(statusId)) {
      return res.status(400).json({ error: 'Invalid status ID' });
    }
    
    const { name, color } = req.body;
    
    // Kiểm tra trạng thái tồn tại
    const [existingStatus] = await db.query('SELECT order_status_id FROM order_status WHERE order_status_id = ?', [statusId]);
    
    if (existingStatus.length === 0) {
      return res.status(404).json({ error: 'Order status not found' });
    }
    
    // Kiểm tra tên mới có trùng với trạng thái khác không
    if (name) {
      const [duplicateName] = await db.query(
        'SELECT order_status_id FROM order_status WHERE order_status_name = ? AND order_status_id != ?',
        [name, statusId]
      );
      
      if (duplicateName.length > 0) {
        return res.status(400).json({ error: 'Status name already exists' });
      }
    }
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('order_status_name = ?');
      values.push(name);
    }
    
    if (color !== undefined) {
      updates.push('order_status_color = ?');
      values.push(color);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }
    
    values.push(statusId);
    
    await db.query(
      `UPDATE order_status SET ${updates.join(', ')} WHERE order_status_id = ?`,
      values
    );
    
    const [updatedStatus] = await db.query('SELECT * FROM order_status WHERE order_status_id = ?', [statusId]);
    
    res.json({
      message: 'Order status updated successfully',
      status: updatedStatus[0]
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * @route   DELETE /api/order-status/:id
 * @desc    Xóa trạng thái đơn hàng
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const statusId = Number(req.params.id);
    if (isNaN(statusId)) {
      return res.status(400).json({ error: 'Invalid status ID' });
    }
    
    // Kiểm tra trạng thái tồn tại
    const [existingStatus] = await db.query('SELECT order_status_id FROM order_status WHERE order_status_id = ?', [statusId]);
    
    if (existingStatus.length === 0) {
      return res.status(404).json({ error: 'Order status not found' });
    }
    
    // Kiểm tra xem có đơn hàng nào đang sử dụng trạng thái này không
    const [usingOrders] = await db.query('SELECT COUNT(*) as count FROM `orders` WHERE order_status_id = ?', [statusId]);
    
    if (usingOrders[0].count > 0) {
      return res.status(400).json({
        error: 'Cannot delete status because it is being used by orders',
        orderCount: usingOrders[0].count
      });
    }
    
    // Xóa trạng thái
    await db.query('DELETE FROM order_status WHERE order_status_id = ?', [statusId]);
    
    res.json({ message: 'Order status deleted successfully' });
  } catch (error) {
    console.error('Error deleting order status:', error);
    res.status(500).json({ error: 'Failed to delete order status' });
  }
});

module.exports = router; 