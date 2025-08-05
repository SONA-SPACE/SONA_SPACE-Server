const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require("../middleware/auth")
/**
 * @route   GET /api/wishlists
 * @desc    Lấy danh sách wishlist của người dùng hiện tại
 * @access  Private
 */
// GET /api/wishlists?status=0 or 1
router.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const status = parseInt(req.query.status);

  if (![0, 1].includes(status)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ (phải là 0 hoặc 1)" });
  }

  try {
    const [items] = await db.query(
      `
      SELECT 
        w.wishlist_id,
        w.quantity,
        w.status,
        w.created_at,

        -- Variant
        v.variant_id,
        v.variant_product_price AS price,
        v.variant_product_price_sale AS price_sale,
        v.variant_product_list_image AS image,
        v.variant_product_quantity ,
        -- Màu chính của variant
        c.color_id,
        c.color_name,
        c.color_hex,

        -- Product
        p.product_id,
        p.product_name ,
        p.product_slug AS slug,
        p.product_image AS product_image,
        p.category_id,

        -- Category
        cat.category_name AS category_name,

        -- Mảng tất cả màu của sản phẩm
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'color_id', col.color_id,
            'color_name', col.color_name,
            'color_hex', col.color_hex
          ))
          FROM variant_product vp2
          LEFT JOIN color col ON vp2.color_id = col.color_id
          WHERE vp2.product_id = p.product_id
        ) AS colors,

        -- Comment stats
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) AS comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) AS average_rating

      FROM wishlist w
      JOIN variant_product v ON w.variant_id = v.variant_id
      JOIN product p ON v.product_id = p.product_id
      LEFT JOIN color c ON v.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id

      WHERE w.user_id = ? AND w.status = ?
      ORDER BY w.created_at DESC
      `,
      [userId, status]
    );

    // Parse JSON string fields (colors)
    const result = items.map((item) => ({
      ...item,
      colors: item.colors ? JSON.parse(item.colors) : [],
      isWishlist: true // luôn true vì đang ở trang wishlist
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching wishlist/cart:", err);
    res.status(500).json({ error: "Lỗi khi lấy dữ liệu giỏ hàng/wishlist" });
  }
});

router.get("/wwww", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const status = parseInt(req.query.status);

  if (![0, 1].includes(status)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ (phải là 0 hoặc 1)" });
  }

  try {
    const [items] = await db.query(
      `
      SELECT 
        w.wishlist_id,
        w.quantity,
        w.status,
        w.created_at,

        -- Variant
        v.variant_id,
        v.variant_product_price AS price,
        v.variant_product_price_sale AS price_sale,
        v.variant_product_price_sale AS priceSale,
        v.variant_product_list_image AS image,

        -- Màu chính của variant
        c.color_id,
        c.color_name,
        c.color_hex,

        -- Product
        p.product_id,
        p.product_name AS name,
        p.product_slug AS slug,
        p.product_image AS product_image,
        p.category_id,

        -- Category: mảng gồm id và name
            (
          SELECT JSON_OBJECT(
            'id', cat.category_id,
            'name', cat.category_name
          )
          FROM category cat
          WHERE cat.category_id = p.category_id
        ) AS category,

        -- Mảng tất cả màu của sản phẩm
     -- Mảng tất cả màu của sản phẩm
    (
  SELECT JSON_ARRAYAGG(col.color_hex)
  FROM variant_product vp2
  LEFT JOIN color col ON vp2.color_id = col.color_id
  WHERE vp2.product_id = p.product_id
) AS colors,



        -- Comment stats
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) AS comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) AS average_rating

      FROM wishlist w
      JOIN variant_product v ON w.variant_id = v.variant_id
      JOIN product p ON v.product_id = p.product_id
      LEFT JOIN color c ON v.color_id = c.color_id

      WHERE w.user_id = ? AND w.status = ?
      ORDER BY w.created_at DESC
      `,
      [userId, status]
    );

    const result = items.map((item) => ({
      ...item,
      colors: item.colors ? JSON.parse(item.colors) : [],
      category: item.category ? JSON.parse(item.category) : [],
      isWishlist: true,
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching wishlist/cart:", err);
    res.status(500).json({ error: "Lỗi khi lấy dữ liệu giỏ hàng/wishlist" });
  }
});



router.get('/variant/:variantId', verifyToken, async (req, res) => {
  try {
    const variantId = Number(req.params.variantId);
    const userId = req.user.id;

    if (isNaN(variantId)) {
      return res.status(400).json({ error: 'Invalid variant ID' });
    }

    const [wishlistItem] = await db.query(
      'SELECT wishlist_id FROM wishlist WHERE variant_id = ? AND user_id = ? AND status = 1',
      [variantId, userId]
    );

    res.status(200).json({
      exists: wishlistItem.length > 0,
      wishlist_id: wishlistItem.length > 0 ? wishlistItem[0].wishlist_id : null
    });
  } catch (error) {
    console.error('Error checking variant in wishlist:', error);
    res.status(500).json({ error: 'Failed to check variant in wishlist' });
  }
});


/**
 * @route   POST /api/wishlists
 * @desc    Thêm sản phẩm vào wishlist
 * @access  Private
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { variant_id, status, quantity = 1 } = req.body;
    const userId = req.user.id;

    if (!variant_id || (status === 0 && quantity < 1)) {
      return res.status(400).json({ error: 'Variant ID and valid quantity are required' });
    }

    if (status !== 0 && status !== 1) {
      return res.status(400).json({ error: 'Invalid status: must be 0 (cart) or 1 (wishlist)' });
    }

    // Kiểm tra variant có tồn tại
    const [variant] = await db.query(
      'SELECT variant_id FROM variant_product WHERE variant_id = ?',
      [variant_id]
    );
    if (!variant.length) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Kiểm tra sản phẩm đã có trong wishlist/cart chưa
    const [existingItem] = await db.query(
      'SELECT wishlist_id, quantity FROM wishlist WHERE user_id = ? AND variant_id = ? AND status = ?',
      [userId, variant_id, status]
    );

    if (status === 1) {
      // Wishlist logic
      if (existingItem.length > 0) {
        return res.status(400).json({ error: 'Variant already in wishlist' });
      }

      const [result] = await db.query(
        'INSERT INTO wishlist (user_id, variant_id, status, created_at) VALUES (?, ?, 1, NOW())',
        [userId, variant_id]
      );

      const [wishlistItem] = await db.query(`
        SELECT 
          w.wishlist_id,
          w.quantity,
          w.created_at,
          v.*,
          (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
          (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) as average_rating
        FROM wishlist w
        JOIN variant_product v ON w.variant_id = v.variant_id
        JOIN product p ON v.product_id = p.product_id
        WHERE w.wishlist_id = ?
      `, [result.insertId]);

      return res.status(201).json({
        message: 'Variant added to wishlist successfully',
        wishlistItem: wishlistItem[0]
      });

    } else {
      // Cart logic (status === 0)
      if (existingItem.length > 0) {
        const newQuantity = existingItem[0].quantity + quantity;

        await db.query(
          'UPDATE wishlist SET quantity = ? WHERE wishlist_id = ?',
          [newQuantity, existingItem[0].wishlist_id]
        );

        return res.status(200).json({ message: 'Cart item updated successfully' });
      }


      const [result] = await db.query(
        'INSERT INTO wishlist (user_id, variant_id, quantity, status, created_at) VALUES (?, ?, ?, 0, NOW())',
        [userId, variant_id, quantity]
      );

      const [cartItem] = await db.query(`
        SELECT 
          w.wishlist_id,
          w.quantity,
          w.created_at,
          v.*,
          (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
          (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) as average_rating
        FROM wishlist w
        JOIN variant_product v ON w.variant_id = v.variant_id
        JOIN product p ON v.product_id = p.product_id
        WHERE w.wishlist_id = ?
      `, [result.insertId]);

      return res.status(201).json({
        message: 'Variant added to cart successfully',
        cartItem: cartItem[0]
      });
    }

  } catch (error) {
    console.error('Error processing wishlist/cart:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * @route   update /api/wishlists/:id
 * @desc    Xóa sản phẩm khỏi wishlist
 * @access  Private
 */
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const wishlistId = Number(req.params.id);
    const { quantity } = req.body;
    const userId = req.user.id;

    if (isNaN(wishlistId) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }

    // Kiểm tra item tồn tại và thuộc user
    const [existingItem] = await db.query(
      'SELECT * FROM wishlist WHERE wishlist_id = ? AND user_id = ? AND status = 0',
      [wishlistId, userId]
    );

    if (!existingItem.length) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm trong giỏ hàng' });
    }

    // Cập nhật số lượng
    await db.query(
      'UPDATE wishlist SET quantity = ?, updated_at = NOW() WHERE wishlist_id = ?',
      [quantity, wishlistId]
    );

    return res.status(200).json({ message: 'Cập nhật số lượng thành công' });
  } catch (error) {
    console.error('Lỗi khi cập nhật số lượng:', error);
    res.status(500).json({ error: 'Cập nhật số lượng thất bại' });
  }
});


/**
 * @route   DELETE /api/wishlists/:id
 * @desc    Xóa sản phẩm khỏi wishlist
 * @access  Private
 */
router.delete('/clear', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Chỉ xóa các wishlist item của user có status = 0
    const [result] = await db.query(
      'DELETE FROM wishlist WHERE user_id = ? AND status = 0',
      [userId]
    );

    res.status(200).json({ message: 'Đã xóa các sản phẩm chưa thanh toán khỏi giỏ hàng' });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xóa giỏ hàng' });
  }
});
router.delete('/clearid', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { selectedItemIds = [] } = req.body;

    console.log(">> Xóa giỏ hàng với userId:", userId);
    console.log(">> selectedItemIds:", selectedItemIds);

    if (!Array.isArray(selectedItemIds) || selectedItemIds.length === 0) {
      return res.status(400).json({ error: 'Danh sách sản phẩm cần xóa không hợp lệ.' });
    }

    const placeholders = selectedItemIds.map(() => '?').join(', ');
    const sql = `DELETE FROM wishlist WHERE user_id = ? AND status = 0 AND wishlist_id IN (${placeholders})`;

    console.log(">> SQL:", sql);
    const [result] = await db.query(sql, [userId, ...selectedItemIds]);

    console.log(">> Xóa thành công:", result);
    return res.status(200).json({ message: 'Đã xóa các sản phẩm đã chọn khỏi giỏ hàng' });
  } catch (error) {
    console.error('❌ Lỗi khi xóa sản phẩm đã chọn khỏi wishlist:', error);
    return res.status(500).json({ error: 'Đã xảy ra lỗi khi xóa giỏ hàng' });
  }
});



// routes/wishlist.js
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const wishlistId = Number(req.params.id);
    const userId = req.user.id;

    if (isNaN(wishlistId)) {
      return res.status(400).json({ error: 'Invalid wishlist ID' });
    }

    // Kiểm tra item có tồn tại và thuộc về người dùng
    const [result] = await db.query(
      'SELECT wishlist_id FROM wishlist WHERE wishlist_id = ? AND user_id = ?',
      [wishlistId, userId]
    );

    if (!result.length) {
      return res.status(404).json({ error: 'Wishlist item not found or not owned by user' });
    }

    // Xóa item
    await db.query('DELETE FROM wishlist WHERE wishlist_id = ?', [wishlistId]);

    res.status(200).json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xóa sản phẩm' });
  }
});



/**
 * @route   DELETE /api/wishlists/product/:productId
 * @desc    Xóa sản phẩm khỏi wishlist dựa vào product_id
 * @access  Private
 */
// Xóa khỏi wishlist theo variant_id
router.delete('/variant/:variantId', verifyToken, async (req, res) => {
  try {
    const variantId = Number(req.params.variantId);
    const userId = req.user.id;

    const [result] = await db.query(
      'DELETE FROM wishlist WHERE variant_id = ? AND user_id = ? AND status = 1',
      [variantId, userId]
    );

    res.status(200).json({ success: true, message: 'Xoá wishlist thành công' });
  } catch (error) {
    console.error('Error deleting from wishlist by variant_id:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xoá' });
  }
});

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