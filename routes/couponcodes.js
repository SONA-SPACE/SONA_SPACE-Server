const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/couponcodes
 * @desc    Lấy danh sách mã giảm giá
 * @access  Private (Admin only)
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const [coupons] = await db.query(`
      SELECT * FROM couponcode
      ORDER BY couponcode_id DESC
    `);

    res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupon codes:', error);
    res.status(500).json({ error: 'Failed to fetch coupon codes' });
  }
});

router.get('/codes',verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        code, 
        title AS discount, 
        description,
        start_time AS validFrom,
        exp_time AS validUntil,
        min_order AS minOrder,
        used,
        is_flash_sale AS isFlashSale,
        combinations
      FROM couponcode
      WHERE exp_time > NOW()
      ORDER BY exp_time ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching public coupon codes:', error);
    res.status(500).json({ error: 'Failed to fetch public coupons' });
  }
});

/**
 * @route   GET /api/couponcodes/:id
 * @desc    Lấy thông tin một mã giảm giá
 * @access  Private (Admin only)
 */
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid coupon ID' });

    const [rows] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Coupon code not found' });

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching coupon code by ID:', error);
    res.status(500).json({ error: 'Failed to fetch coupon code' });
  }
});

/**
 * 
 * @route   POST /api/couponcodes
 * @desc    Tạo mã giảm giá mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      value_price,
      start_time,
      exp_time,
      min_order,
      used,
      is_flash_sale,
      combinations
    } = req.body;

    // Validate bắt buộc
    if (!code || !title || !value_price || !exp_time) {
      return res.status(400).json({ error: 'Code, title, value_price and exp_time are required' });
    }

    // Kiểm tra mã trùng
    const [exist] = await db.query('SELECT * FROM couponcode WHERE code = ?', [code]);
    if (exist.length > 0) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    // Validate value_price
    if (isNaN(value_price) || Number(value_price) <= 0) {
      return res.status(400).json({ error: 'value_price must be a positive number' });
    }

    // Validate ngày
    const startDate = start_time ? new Date(start_time) : new Date();
    const endDate = new Date(exp_time);
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'exp_time must be after start_time' });
    }

    // Thêm coupon mới
    const [result] = await db.query(`
      INSERT INTO couponcode (
        user_id,
        code,
        title,
        value_price,
        description,
        start_time,
        exp_time,
        min_order,
        used,
        is_flash_sale,
        combinations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id, // từ verifyToken
      code,
      title,
      value_price,
      description || null,
      startDate,
      endDate,
      min_order || null,
      used || false,
      is_flash_sale || false,
      combinations || null
    ]);

    const [newCoupon] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [result.insertId]);

    res.status(201).json({
      message: 'Coupon code created successfully',
      coupon: newCoupon[0]
    });
  } catch (error) {
    console.error('Error creating coupon code:', error);
    res.status(500).json({ error: 'Failed to create coupon code' });
  }
});


/**
 * @route   PUT /api/couponcodes/:id
 * @desc    Cập nhật mã giảm giá
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid coupon ID' });

    const {
      code,
      title,
      description,
      value_price,
      start_time,
      exp_time,
      min_order,
      used,
      is_flash_sale,
      combinations
    } = req.body;

    const [exist] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    if (!exist.length) return res.status(404).json({ error: 'Coupon not found' });

    const updates = [];
    const values = [];

    if (code !== undefined) { updates.push('code = ?'); values.push(code); }
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (value_price !== undefined) { updates.push('value_price = ?'); values.push(value_price); }
    if (start_time !== undefined) { updates.push('start_time = ?'); values.push(new Date(start_time)); }
    if (exp_time !== undefined) { updates.push('exp_time = ?'); values.push(new Date(exp_time)); }
    if (min_order !== undefined) { updates.push('min_order = ?'); values.push(min_order); }
    if (used !== undefined) { updates.push('used = ?'); values.push(used ? 1 : 0); }
    if (is_flash_sale !== undefined) { updates.push('is_flash_sale = ?'); values.push(is_flash_sale ? 1 : 0); }
    if (combinations !== undefined) { updates.push('combinations = ?'); values.push(combinations); }

    if (!updates.length) return res.status(400).json({ error: 'No update data provided' });

    values.push(id);
    await db.query(`UPDATE couponcode SET ${updates.join(', ')} WHERE couponcode_id = ?`, values);

    const [updated] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    res.json({ message: 'Coupon updated successfully', coupon: updated[0] });
  } catch (error) {
    console.error('Error updating coupon code:', error);
    res.status(500).json({ error: 'Failed to update coupon code' });
  }
});

// DELETE mã giảm giá
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid coupon ID' });

    const [exist] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    if (!exist.length) return res.status(404).json({ error: 'Coupon not found' });

    await db.query('DELETE FROM couponcode WHERE couponcode_id = ?', [id]);
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon code:', error);
    res.status(500).json({ error: 'Failed to delete coupon code' });
  }
});

/**
 * @route   POST /api/couponcodes/validate
 * @desc    Kiểm tra tính hợp lệ của mã giảm giá
 * @access  Private
 */
router.post('/validate', verifyToken, async (req, res) => {
  try {
    const { code, cart_total } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const [coupons] = await db.query(`
      SELECT * FROM couponcode 
      WHERE code = ? AND used = 0
    `, [code]);

    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Invalid or inactive coupon code' });
    }

    const coupon = coupons[0];
    const now = new Date();

    // Kiểm tra thời gian bắt đầu
    const startTime = coupon.start_time ? new Date(coupon.start_time) : null;
    if (startTime && startTime > now) {
      return res.status(400).json({ error: 'Coupon code is not yet active' });
    }

    // Kiểm tra thời gian hết hạn
    const expTime = new Date(coupon.exp_time);
    if (expTime < now) {
      return res.status(400).json({ error: 'Coupon code has expired' });
    }

    // Kiểm tra đơn hàng tối thiểu
    if (coupon.min_order !== null && cart_total < coupon.min_order) {
      return res.status(400).json({
        error: 'Order total does not meet minimum purchase requirement',
        min_purchase: coupon.min_order
      });
    }

    // Tính giảm giá dựa trên discount_type
    let discountAmount = 0;
    const discountType = coupon.discount_type;
    const value = Number(coupon.value_price);

    if (discountType === 'percentage') {
      discountAmount = Math.round((cart_total * value) / 100);
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(cart_total, value);
    }

    res.json({
      valid: true,
      coupon: {
        couponcode_id: coupon.couponcode_id,
        code: coupon.code,
        title: coupon.title,
        value_price: coupon.value_price,
        discount_type: coupon.discount_type, 
        discount_amount: discountAmount,
        exp_time: coupon.exp_time,
        description: coupon.description,
        is_flash_sale: !!coupon.is_flash_sale,
        combinations: coupon.combinations,
      }
    });

  } catch (error) {
    console.error('Error validating coupon code:', error);
    res.status(500).json({ error: 'Failed to validate coupon code' });
  }
});



module.exports = router; 