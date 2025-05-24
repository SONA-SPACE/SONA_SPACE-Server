const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/variants
 * @desc    Lấy danh sách biến thể sản phẩm
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const product_id = req.query.product_id;
    
    let query = 'SELECT * FROM variant_product';
    let params = [];
    
    if (product_id) {
      query += ' WHERE product_id = ?';
      params.push(product_id);
    }
    
    query += ' ORDER BY variant_id ASC';
    
    const [variants] = await db.query(query, params);
    res.json(variants);
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

/**
 * @route   GET /api/variants/:id
 * @desc    Lấy thông tin chi tiết một biến thể
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid variant ID' });
    }
    
    const [variants] = await db.query('SELECT * FROM variant_product WHERE variant_id = ?', [id]);
    
    if (variants.length === 0) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    
    res.json(variants[0]);
  } catch (error) {
    console.error('Error fetching variant:', error);
    res.status(500).json({ error: 'Failed to fetch variant' });
  }
});

/**
 * @route   POST /api/variants
 * @desc    Tạo biến thể mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { product_id, variant_colors, variant_materials, variant_width, variant_height, variant_depth, list_img } = req.body;
    
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    
    // Kiểm tra sản phẩm tồn tại
    const [product] = await db.query('SELECT product_id FROM product WHERE product_id = ?', [product_id]);
    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const [result] = await db.query(
      'INSERT INTO variant_product (product_id, variant_colors, variant_materials, variant_width, variant_height, variant_depth, list_img) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_id, variant_colors || null, variant_materials || null, variant_width || null, variant_height || null, variant_depth || null, list_img || null]
    );
    
    const [newVariant] = await db.query('SELECT * FROM variant_product WHERE variant_id = ?', [result.insertId]);
    
    res.status(201).json({
      message: 'Variant created successfully',
      variant: newVariant[0]
    });
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({ error: 'Failed to create variant' });
  }
});

/**
 * @route   PUT /api/variants/:id
 * @desc    Cập nhật thông tin biến thể
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid variant ID' });
    }
    
    const { variant_colors, variant_materials, variant_width, variant_height, variant_depth, list_img } = req.body;
    
    // Kiểm tra biến thể tồn tại
    const [existingVariant] = await db.query('SELECT variant_id FROM variant_product WHERE variant_id = ?', [id]);
    if (existingVariant.length === 0) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    
    await db.query(`
      UPDATE variant_product SET
        variant_colors = COALESCE(?, variant_colors),
        variant_materials = COALESCE(?, variant_materials),
        variant_width = COALESCE(?, variant_width),
        variant_height = COALESCE(?, variant_height),
        variant_depth = COALESCE(?, variant_depth),
        list_img = COALESCE(?, list_img)
      WHERE variant_id = ?
    `, [variant_colors || null, variant_materials || null, variant_width || null, variant_height || null, variant_depth || null, list_img || null, id]);
    
    const [updatedVariant] = await db.query('SELECT * FROM variant_product WHERE variant_id = ?', [id]);
    
    res.json({
      message: 'Variant updated successfully',
      variant: updatedVariant[0]
    });
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
});

/**
 * @route   DELETE /api/variants/:id
 * @desc    Xóa biến thể
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid variant ID' });
    }
    
    // Kiểm tra biến thể tồn tại
    const [existingVariant] = await db.query('SELECT variant_id FROM variant_product WHERE variant_id = ?', [id]);
    if (existingVariant.length === 0) {
      return res.status(404).json({ error: 'Variant not found' });
    }
    
    // Kiểm tra biến thể có trong order_items không
    const [orderItems] = await db.query('SELECT id FROM order_items WHERE variant_id = ? LIMIT 1', [id]);
    if (orderItems.length > 0) {
      return res.status(400).json({ error: 'Cannot delete variant that is used in orders' });
    }
    
    await db.query('DELETE FROM variant_product WHERE variant_id = ?', [id]);
    
    res.json({ message: 'Variant deleted successfully' });
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
});

module.exports = router; 