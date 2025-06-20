const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * @route   GET /api/wishlists-id/:userId
 * @desc    Lấy danh sách yêu thích (wishlist) của user theo user_id (Public API)
 * @access  Public
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }

    // Lấy danh sách yêu thích của user
    const [wishlists] = await db.query(`
      SELECT 
        wl.wishlist_id,
        wl.status,
        wl.created_at,
        vp.variant_id,
        vp.product_id,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_list_image,
        u.user_id,
        u.user_name,
        u.user_gmail,
        u.user_address
      FROM wishlist wl
      JOIN user u ON wl.user_id = u.user_id
      JOIN variant_product vp ON wl.variant_id = vp.variant_id
      WHERE wl.user_id = ? AND wl.deleted_at IS NULL
      ORDER BY wl.created_at DESC
    `, [userId]);

    if (wishlists.length === 0) {
      return res.json({ 
        message: 'No wishlist items found for this user',
        wishlists: []
      });
    }

    res.json({
      user_id: userId,
      wishlist_count: wishlists.length,
      wishlists: wishlists
    });
  } catch (error) {
    console.error('Error fetching user wishlists:', error);
    res.status(500).json({ 
      error: 'Failed to fetch wishlists',
      details: error.message
    });
  }
});

module.exports = router;
