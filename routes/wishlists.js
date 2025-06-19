const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * @route   GET /api/wishlists
 * @desc    Lấy danh sách wishlist của người dùng hiện tại
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Lấy danh sách wishlist với thông tin sản phẩm
    const [wishlist] = await db.query(`
      SELECT 
        w.wishlist_id,
        w.created_at,
        p.*,
        c.category_name,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) as average_rating
      FROM wishlist w
      JOIN product p ON w.product_id = p.product_id
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `, [userId]);
    
    res.json(wishlist);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

/**
 * @route   POST /api/wishlists
 * @desc    Thêm sản phẩm vào wishlist
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { product_id } = req.body;
    const userId = req.user.id;

    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Kiểm tra sản phẩm tồn tại
    const [product] = await db.query('SELECT product_id FROM product WHERE product_id = ?', [product_id]);

    if (!product.length) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Kiểm tra sản phẩm đã có trong wishlist chưa (chỉ kiểm tra status = 1)
    const [existingItem] = await db.query(
      'SELECT wishlist_id FROM wishlist WHERE user_id = ? AND product_id = ? AND status = 1',
      [userId, product_id]
    );

    if (existingItem.length > 0) {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }

    // Thêm vào wishlist với status = 1
    const [result] = await db.query(
      'INSERT INTO wishlist (user_id, product_id, status, created_at) VALUES (?, ?, 1, NOW())',
      [userId, product_id]
    );

    // Lấy thông tin wishlist item vừa tạo
    const [wishlistItem] = await db.query(`
      SELECT 
        w.wishlist_id,
        w.created_at,
        p.*,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) as average_rating
      FROM wishlist w
      JOIN product p ON w.product_id = p.product_id
      WHERE w.wishlist_id = ?
    `, [result.insertId]);

    res.status(201).json({
      message: 'Product added to wishlist successfully',
      wishlistItem: wishlistItem[0]
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add product to wishlist' });
  }
});

/**
 * @route   DELETE /api/wishlists/:id
 * @desc    Xóa sản phẩm khỏi wishlist
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const wishlistId = Number(req.params.id);
    const userId = req.user.id;
    
    if (isNaN(wishlistId)) {
      return res.status(400).json({ error: 'Invalid wishlist ID' });
    }
    
    // Kiểm tra wishlist item tồn tại và thuộc về người dùng hiện tại
    const [wishlistItem] = await db.query(
      'SELECT wishlist_id FROM wishlist WHERE wishlist_id = ? AND user_id = ?',
      [wishlistId, userId]
    );
    
    if (!wishlistItem.length) {
      return res.status(404).json({ error: 'Wishlist item not found or not owned by user' });
    }
    
    // Xóa khỏi wishlist
    await db.query('DELETE FROM wishlist WHERE wishlist_id = ?', [wishlistId]);
    
    res.json({ message: 'Product removed from wishlist successfully' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove product from wishlist' });
  }
});

/**
 * @route   DELETE /api/wishlists/product/:productId
 * @desc    Xóa sản phẩm khỏi wishlist dựa vào product_id
 * @access  Private
 */
router.delete('/product/:productId', async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const userId = req.user.id;
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    // Kiểm tra sản phẩm có trong wishlist không
    const [wishlistItem] = await db.query(
      'SELECT wishlist_id FROM wishlist WHERE product_id = ? AND user_id = ?',
      [productId, userId]
    );
    
    if (!wishlistItem.length) {
      return res.status(404).json({ error: 'Product not found in wishlist' });
    }
    
    // Xóa khỏi wishlist
    await db.query(
      'DELETE FROM wishlist WHERE product_id = ? AND user_id = ?', 
      [productId, userId]
    );
    
    res.json({ message: 'Product removed from wishlist successfully' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove product from wishlist' });
  }
});

/**
 * @route   GET /api/wishlists/check/:productId
 * @desc    Kiểm tra sản phẩm có trong wishlist không
 * @access  Private
 */
router.get('/check/:productId', async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const userId = req.user.id;
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    // Kiểm tra sản phẩm có trong wishlist không
    const [wishlistItem] = await db.query(
      'SELECT wishlist_id FROM wishlist WHERE product_id = ? AND user_id = ?',
      [productId, userId]
    );
    
    res.json({
      in_wishlist: wishlistItem.length > 0,
      wishlist_id: wishlistItem.length > 0 ? wishlistItem[0].wishlist_id : null
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500).json({ error: 'Failed to check wishlist status' });
  }
});

module.exports = router; 