const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Endpoint công khai - không cần xác thực
router.get('/public', async (req, res) => {
  try {
    res.json({ message: 'Endpoint công khai hoạt động' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint được bảo vệ - cần xác thực
router.get('/protected', verifyToken, async (req, res) => {
  try {
    res.json({ 
      message: 'Endpoint được bảo vệ hoạt động', 
      user: req.user 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint chỉ dành cho admin
router.get('/admin', verifyToken, isAdmin, async (req, res) => {
  try {
    res.json({ 
      message: 'Endpoint dành cho admin hoạt động', 
      user: req.user 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint để kiểm tra truy vấn cơ sở dữ liệu đơn giản
router.get('/query-test', verifyToken, async (req, res) => {
  try {
    const [result] = await db.query('SELECT COUNT(*) as count FROM `orders`');
    res.json({ 
      message: 'Truy vấn cơ sở dữ liệu hoạt động',
      result: result[0]
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ error: 'Database query error', details: error.message });
  }
});

// Endpoint để kiểm tra truy vấn JOIN
router.get('/join-test', verifyToken, async (req, res) => {
  try {
    const [result] = await db.query(`
      SELECT 
        o.order_id,
        os.order_status_name as status_name,
        u.user_gmail as user_email,
        u.user_name as user_name
      FROM \`order\` o
      LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LIMIT 1
    `);
    res.json({ 
      message: 'Truy vấn JOIN hoạt động',
      result: result[0]
    });
  } catch (error) {
    console.error('Database join error:', error);
    res.status(500).json({ error: 'Database join error', details: error.message });
  }
});

module.exports = router; 