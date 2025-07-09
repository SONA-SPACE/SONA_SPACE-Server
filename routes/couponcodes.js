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
router.get('/user-has-coupon', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        *
      FROM user_has_coupon
    `);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi khi gọi has-coupon', error);
    res.status(500).json({ error: 'Failed to fetch public has-coupons' });
  }
});
router.get('/codes', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        c.code, 
        c.title AS discount, 
        c.description,
        c.start_time AS validFrom,
        c.exp_time AS validUntil,
        c.min_order AS minOrder,
        c.used,
        c.status,
        c.is_flash_sale AS isFlashSale,
        c.combinations,
        u.status AS userUsedStatus 
      FROM couponcode c
      LEFT JOIN user_has_coupon u 
        ON c.couponcode_id = u.couponcode_id AND u.user_id = ?
      WHERE c.exp_time > NOW() AND c.status != 0
      ORDER BY c.exp_time ASC
    `, [userId]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching coupon codes with usage status:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});


router.get('/admin', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        couponcode_id AS id,
        code, 
        title,
        value_price AS discount, 
        description,
        is_flash_sale AS isFlashSale,
        discount_type,
        start_time ,
        used,
        status,
        exp_time 
      FROM couponcode
      WHERE exp_time > NOW()
      ORDER BY start_time DESC
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
      combinations,
      discount_type,
      status,
    } = req.body;

    if (!code || !title || !value_price || !exp_time || !discount_type || status === undefined) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }

    if (used !== undefined && (isNaN(used) || Number(used) <= 0)) {
      return res.status(400).json({ error: 'Lượt sử dụng không hợp lệ' });
    }

    const [exist] = await db.query('SELECT * FROM couponcode WHERE code = ?', [code]);
    if (exist.length > 0) {
      return res.status(400).json({ error: 'Mã voucher đã tồn tại' });
    }

    if (isNaN(value_price) || Number(value_price) <= 0) {
      return res.status(400).json({ error: 'Giá giảm không hợp lệ' });
    }

    const startDate = start_time ? new Date(start_time) : new Date();
    const endDate = new Date(exp_time);
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
    }

    const [result] = await db.query(`
      INSERT INTO couponcode (
        user_id, code, title, value_price, description, start_time, exp_time,
        min_order, used, is_flash_sale, combinations, discount_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.id, code, title, value_price, description || null, startDate, endDate,
      min_order || null, used || 1, is_flash_sale || false, combinations || null,
      discount_type, status
    ]);

    const [newCoupon] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [result.insertId]);
    res.status(201).json({ message: 'Tạo voucher thành công', coupon: newCoupon[0] });
  } catch (error) {
    console.error('Error creating coupon code:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi tạo voucher' });
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
    if (isNaN(id)) return res.status(400).json({ error: 'ID voucher không hợp lệ' });

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
      combinations,
      discount_type,
      status
    } = req.body;

    // Kiểm tra voucher có tồn tại
    const [exist] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    if (!exist.length) return res.status(404).json({ error: 'Không tìm thấy voucher' });

    const updates = [];
    const values = [];

    // Kiểm tra nếu code bị trùng với mã khác
    if (code !== undefined) {
      const [duplicate] = await db.query('SELECT * FROM couponcode WHERE code = ? AND couponcode_id != ?', [code, id]);
      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Mã voucher đã tồn tại' });
      }
      updates.push('code = ?');
      values.push(code);
    }

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (value_price !== undefined) {
      if (isNaN(value_price) || Number(value_price) <= 0) {
        return res.status(400).json({ error: 'Giá giảm không hợp lệ' });
      }
      updates.push('value_price = ?');
      values.push(value_price);
    }

    if (start_time !== undefined) {
      updates.push('start_time = ?');
      values.push(new Date(start_time));
    }

    if (exp_time !== undefined) {
      const endDate = new Date(exp_time);
      if (start_time) {
        const startDate = new Date(start_time);
        if (endDate <= startDate) {
          return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
        }
      }
      updates.push('exp_time = ?');
      values.push(endDate);
    }

    if (min_order !== undefined) {
      updates.push('min_order = ?');
      values.push(min_order);
    }

    if (used !== undefined) {
      updates.push('used = ?');
      values.push(Number(used)); 
    }

    if (is_flash_sale !== undefined) {
      updates.push('is_flash_sale = ?');
      values.push(is_flash_sale ? 1 : 0);
    }

    if (combinations !== undefined) {
      updates.push('combinations = ?');
      values.push(combinations);
    }

    if (discount_type !== undefined) {
      if (!['percentage', 'fixed'].includes(discount_type)) {
        return res.status(400).json({ error: 'Kiểu giảm giá không hợp lệ' });
      }
      updates.push('discount_type = ?');
      values.push(discount_type);
    }

    if (status !== undefined) {
      if (![0, 1].includes(Number(status))) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      }
      updates.push('status = ?');
      values.push(Number(status));
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'Không có trường nào để cập nhật' });
    }

    values.push(id);
    await db.query(`UPDATE couponcode SET ${updates.join(', ')} WHERE couponcode_id = ?`, values);

    const [updated] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    res.json({ message: 'Cập nhật voucher thành công', coupon: updated[0] });
  } catch (error) {
    console.error('Error updating coupon code:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật voucher' });
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
      WHERE code = ? AND used > 0
    `, [code]);

    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Bạn đã sử dụng voucher này rồi' });
    }

    const coupon = coupons[0];
    const now = new Date();

    // Kiểm tra thời gian bắt đầu
    const startTime = coupon.start_time ? new Date(coupon.start_time) : null;
    if (startTime && startTime > now) {
      return res.status(400).json({ error: 'Voucher chưa hoạt động' });
    }

    // Kiểm tra thời gian hết hạn
    const expTime = new Date(coupon.exp_time);
    if (expTime < now) {
      return res.status(400).json({ error: 'Voucher đã hêt hạn' });
    }

    // Kiểm tra đơn hàng tối thiểu
    if (coupon.min_order !== null && cart_total < coupon.min_order) {
      return res.status(400).json({
        error: 'Tổng giá trị đơn hàng không đáp ứng yêu cầu mua tối thiểu',
        min_purchase: coupon.min_order
      });
    }

    // Tính giảm giá
    let discountAmount = 0;
    const discountType = coupon.discount_type;
    const value = Number(coupon.value_price);

    if (discountType === 'percentage') {
      discountAmount = Math.round((cart_total * value) / 100);
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(cart_total, value);
    }

    // Kiểm tra lượt sử dụng
    const [usedBefore] = await db.query(
      'SELECT * FROM user_has_coupon WHERE user_id = ? AND couponcode_id = ? AND status = 1',
      [req.user.id, coupon.couponcode_id]
    );

    if (usedBefore.length > 0) {
      return res.status(400).json({ error: 'Bạn đã sử dụng mã giảm giá này rồi' });
    }

    //  Trừ 1 lượt sử dụng
    await db.query('UPDATE couponcode SET used = used - 1 WHERE couponcode_id = ? AND used > 0', [coupon.couponcode_id]);
    // Ngươidi dùng đã sử dụng mã giảm giá
    await db.query(`
      INSERT INTO user_has_coupon (user_id, couponcode_id, status)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE status = 1, used_at = NOW()
      `, [req.user.id, coupon.couponcode_id]);


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