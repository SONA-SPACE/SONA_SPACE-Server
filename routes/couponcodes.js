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
      SELECT * FROM coupon_code
      ORDER BY created_at DESC
    `);
    
    res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupon codes:', error);
    res.status(500).json({ error: 'Failed to fetch coupon codes' });
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
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid coupon ID' });
    }
    
    const [coupons] = await db.query('SELECT * FROM coupon_code WHERE id = ?', [id]);
    
    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Coupon code not found' });
    }
    
    res.json(coupons[0]);
  } catch (error) {
    console.error('Error fetching coupon code:', error);
    res.status(500).json({ error: 'Failed to fetch coupon code' });
  }
});

/**
 * @route   POST /api/couponcodes
 * @desc    Tạo mã giảm giá mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      min_purchase,
      max_discount,
      starts_at,
      expires_at,
      usage_limit,
      description
    } = req.body;
    
    // Kiểm tra các trường bắt buộc
    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ error: 'Code, discount type and discount value are required' });
    }
    
    // Kiểm tra loại giảm giá hợp lệ
    if (!['percentage', 'fixed_amount'].includes(discount_type)) {
      return res.status(400).json({ error: 'Discount type must be either "percentage" or "fixed_amount"' });
    }
    
    // Kiểm tra giá trị giảm giá hợp lệ
    if (isNaN(Number(discount_value)) || Number(discount_value) <= 0) {
      return res.status(400).json({ error: 'Discount value must be a positive number' });
    }
    
    // Kiểm tra giới hạn giá trị giảm giá cho loại phần trăm
    if (discount_type === 'percentage' && Number(discount_value) > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
    }
    
    // Kiểm tra mã giảm giá đã tồn tại chưa
    const [existingCoupons] = await db.query('SELECT id FROM coupon_code WHERE code = ?', [code]);
    
    if (existingCoupons.length > 0) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    
    // Xử lý ngày bắt đầu và kết thúc
    const startsAtDate = starts_at ? new Date(starts_at) : new Date();
    let expiresAtDate = null;
    
    if (expires_at) {
      expiresAtDate = new Date(expires_at);
      if (expiresAtDate <= startsAtDate) {
        return res.status(400).json({ error: 'Expiration date must be after start date' });
      }
    }
    
    // Tạo mã giảm giá mới
    const [result] = await db.query(`
      INSERT INTO coupon_code (
        code, 
        discount_type, 
        discount_value, 
        min_purchase, 
        max_discount, 
        starts_at, 
        expires_at, 
        usage_limit, 
        description, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      code,
      discount_type,
      discount_value,
      min_purchase || null,
      max_discount || null,
      startsAtDate,
      expiresAtDate,
      usage_limit || null,
      description || null
    ]);
    
    const [newCoupon] = await db.query('SELECT * FROM coupon_code WHERE id = ?', [result.insertId]);
    
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
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid coupon ID' });
    }
    
    const {
      code,
      discount_type,
      discount_value,
      min_purchase,
      max_discount,
      starts_at,
      expires_at,
      usage_limit,
      description,
      is_active
    } = req.body;
    
    // Kiểm tra mã giảm giá tồn tại
    const [existingCoupons] = await db.query('SELECT * FROM coupon_code WHERE id = ?', [id]);
    
    if (existingCoupons.length === 0) {
      return res.status(404).json({ error: 'Coupon code not found' });
    }
    
    const existingCoupon = existingCoupons[0];
    
    // Kiểm tra mã giảm giá trùng lặp
    if (code && code !== existingCoupon.code) {
      const [duplicateCodes] = await db.query('SELECT id FROM coupon_code WHERE code = ? AND id != ?', [code, id]);
      
      if (duplicateCodes.length > 0) {
        return res.status(400).json({ error: 'Coupon code already exists' });
      }
    }
    
    // Kiểm tra loại giảm giá hợp lệ
    if (discount_type && !['percentage', 'fixed_amount'].includes(discount_type)) {
      return res.status(400).json({ error: 'Discount type must be either "percentage" or "fixed_amount"' });
    }
    
    // Kiểm tra giá trị giảm giá hợp lệ
    if (discount_value && (isNaN(Number(discount_value)) || Number(discount_value) <= 0)) {
      return res.status(400).json({ error: 'Discount value must be a positive number' });
    }
    
    // Kiểm tra giới hạn giá trị giảm giá cho loại phần trăm
    if ((discount_type === 'percentage' || (!discount_type && existingCoupon.discount_type === 'percentage')) 
        && discount_value && Number(discount_value) > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
    }
    
    // Xử lý ngày bắt đầu và kết thúc
    let startsAtDate = existingCoupon.starts_at;
    let expiresAtDate = existingCoupon.expires_at;
    
    if (starts_at) {
      startsAtDate = new Date(starts_at);
    }
    
    if (expires_at) {
      expiresAtDate = new Date(expires_at);
      if (expiresAtDate <= startsAtDate) {
        return res.status(400).json({ error: 'Expiration date must be after start date' });
      }
    }
    
    // Cập nhật mã giảm giá
    const updates = [];
    const values = [];
    
    if (code !== undefined) {
      updates.push('code = ?');
      values.push(code);
    }
    
    if (discount_type !== undefined) {
      updates.push('discount_type = ?');
      values.push(discount_type);
    }
    
    if (discount_value !== undefined) {
      updates.push('discount_value = ?');
      values.push(discount_value);
    }
    
    if (min_purchase !== undefined) {
      updates.push('min_purchase = ?');
      values.push(min_purchase || null);
    }
    
    if (max_discount !== undefined) {
      updates.push('max_discount = ?');
      values.push(max_discount || null);
    }
    
    if (starts_at !== undefined) {
      updates.push('starts_at = ?');
      values.push(startsAtDate);
    }
    
    if (expires_at !== undefined) {
      updates.push('expires_at = ?');
      values.push(expiresAtDate);
    }
    
    if (usage_limit !== undefined) {
      updates.push('usage_limit = ?');
      values.push(usage_limit || null);
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    
    updates.push('updated_at = NOW()');
    
    if (updates.length === 1 && updates[0] === 'updated_at = NOW()') {
      return res.status(400).json({ error: 'No update data provided' });
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE coupon_code SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const [updatedCoupon] = await db.query('SELECT * FROM coupon_code WHERE id = ?', [id]);
    
    res.json({
      message: 'Coupon code updated successfully',
      coupon: updatedCoupon[0]
    });
  } catch (error) {
    console.error('Error updating coupon code:', error);
    res.status(500).json({ error: 'Failed to update coupon code' });
  }
});

/**
 * @route   DELETE /api/couponcodes/:id
 * @desc    Xóa mã giảm giá
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid coupon ID' });
    }
    
    // Kiểm tra mã giảm giá tồn tại
    const [existingCoupons] = await db.query('SELECT * FROM coupon_code WHERE id = ?', [id]);
    
    if (existingCoupons.length === 0) {
      return res.status(404).json({ error: 'Coupon code not found' });
    }
    
    // Kiểm tra mã giảm giá đã được sử dụng
    const [usedCoupons] = await db.query('SELECT COUNT(*) as count FROM orders WHERE coupon_id = ?', [id]);
    
    if (usedCoupons[0].count > 0) {
      // Thay vì xóa, chỉ vô hiệu hóa mã giảm giá
      await db.query('UPDATE coupon_code SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);
      
      return res.json({
        message: 'Coupon code has been used in orders. It has been deactivated instead of deleted.',
        deactivated: true
      });
    }
    
    // Xóa mã giảm giá
    await db.query('DELETE FROM coupon_code WHERE id = ?', [id]);
    
    res.json({ message: 'Coupon code deleted successfully' });
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
    
    // Lấy thông tin mã giảm giá
    const [coupons] = await db.query(`
      SELECT * FROM coupon_code 
      WHERE code = ? AND is_active = 1
    `, [code]);
    
    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Invalid or inactive coupon code' });
    }
    
    const coupon = coupons[0];
    
    // Kiểm tra thời hạn
    const now = new Date();
    
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return res.status(400).json({ error: 'Coupon code is not yet active' });
    }
    
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return res.status(400).json({ error: 'Coupon code has expired' });
    }
    
    // Kiểm tra giới hạn sử dụng
    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      return res.status(400).json({ error: 'Coupon usage limit has been reached' });
    }
    
    // Kiểm tra giá trị đơn hàng tối thiểu
    if (coupon.min_purchase !== null && cart_total < coupon.min_purchase) {
      return res.status(400).json({
        error: 'Order total does not meet minimum purchase requirement',
        min_purchase: coupon.min_purchase
      });
    }
    
    // Tính toán giá trị giảm giá
    let discountAmount = 0;
    
    if (coupon.discount_type === 'percentage') {
      discountAmount = (cart_total * coupon.discount_value) / 100;
      
      // Áp dụng giảm giá tối đa nếu có
      if (coupon.max_discount !== null && discountAmount > coupon.max_discount) {
        discountAmount = coupon.max_discount;
      }
    } else { // fixed_amount
      discountAmount = coupon.discount_value;
      
      // Đảm bảo giảm giá không lớn hơn giá trị đơn hàng
      if (discountAmount > cart_total) {
        discountAmount = cart_total;
      }
    }
    
    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount
      }
    });
  } catch (error) {
    console.error('Error validating coupon code:', error);
    res.status(500).json({ error: 'Failed to validate coupon code' });
  }
});

module.exports = router; 