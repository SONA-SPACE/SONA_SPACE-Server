const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/rooms
 * @desc    Lấy danh sách phòng
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const [rooms] = await db.query(`
      SELECT 
        r.*, 
        (SELECT COUNT(*) FROM room_product rp WHERE rp.room_id = r.room_id) as product_count
      FROM room r
      ORDER BY r.room_name ASC
    `);

    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * @route   GET /api/rooms/:slug
 * @desc    Lấy thông tin một phòng
 * @access  Public
 */
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      return res.status(400).json({ error: 'Invalid room slug' });
    }

    const [rooms] = await db.query(`
       SELECT 
        r.room_id,
        r.room_name,
        r.slug,
        r.room_image,
        r.room_description,
        r.created_at,
        r.updated_at,
        r.deleted_at,
        COUNT(rp.product_id) as product_count
      FROM room r
      LEFT JOIN room_product rp ON r.room_id = rp.room_id
      WHERE r.slug = ?
      GROUP BY r.room_id
    `, [slug]);

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(rooms[0]);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

/**
 * @route   POST /api/rooms
 * @desc    Tạo phòng mới
 * @access  Private (Admin only)
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, image, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Room name and slug are required' });
    }

    // Kiểm tra tên phòng đã tồn tại chưa
    const [existingRooms] = await db.query('SELECT room_id FROM room WHERE room_name = ? AND slug = ?', [name, slug]);

    if (existingRooms.length > 0) {
      return res.status(400).json({ error: 'Room name already exists' });
    }

    const [result] = await db.query(
      'INSERT INTO room (room_name, room_description, room_image, slug, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, description || null, image || null, slug]
    );

    const [newRoom] = await db.query('SELECT * FROM room WHERE room_id = ?', [result.insertId]);

    res.status(201).json({
      message: 'Room created successfully',
      room: newRoom[0]
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * @route   PUT /api/rooms/:id
 * @desc    Cập nhật thông tin phòng
 * @access  Private (Admin only)
 */
// verifyToken, isAdmin,
router.put('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      return res.status(400).json({ error: 'Invalid room slug' });
    }

    const { name, description } = req.body;

    // Kiểm tra phòng tồn tại
    const [existingRoom] = await db.query('SELECT room_id FROM room WHERE slug = ?', [slug]);

    if (existingRoom.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Kiểm tra tên mới có trùng với phòng khác không
    if (name) {
      const [duplicateName] = await db.query(
        'SELECT room_id FROM room WHERE room_name = ? AND room_id != ?',
        [name, slug]
      );

      if (duplicateName.length > 0) {
        return res.status(400).json({ error: 'Room name already exists' });
      }
    }

    await db.query(`
      UPDATE room SET
        room_name = COALESCE(?, room_name),
        room_description = COALESCE(?, room_description),
        updated_at = NOW()
      WHERE slug = ?
    `, [name || null, description || null, slug]);

    const [updatedRoom] = await db.query('SELECT * FROM room WHERE slug = ?', [slug]);

    res.json({
      message: 'Room updated successfully',
      room: updatedRoom[0]
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

/**
 * @route   DELETE /api/rooms/:slug
 * @desc    Xóa phòng
 * @access  Private (Admin only)
 */
router.delete('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      return res.status(400).json({ error: 'Invalid room slug' });
    }

    // Kiểm tra phòng tồn tại
    const [existingRoom] = await db.query('SELECT room_id FROM room WHERE slug = ?', [slug]);

    if (existingRoom.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomId = existingRoom[0].room_id;

    // Xóa các liên kết với sản phẩm
    await db.query('DELETE FROM room_product WHERE room_id = ?', [roomId]);

    // Xóa phòng
    await db.query('DELETE FROM room WHERE room_id = ?', [roomId]);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

/**
 * @route   GET /api/rooms/:id/products
 * @desc    Lấy danh sách sản phẩm trong phòng
 * @access  Public
 */
router.get('/:slug/products', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      return res.status(400).json({ error: 'Invalid room slug' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    // Kiểm tra phòng tồn tại và lấy room_id
    const [roomRows] = await db.query('SELECT * FROM room WHERE slug = ?', [slug]);

    if (roomRows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = roomRows[0];
    const roomId = room.room_id;

    // Đếm tổng sản phẩm trong phòng
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total
       FROM room_product rp
       JOIN product p ON rp.product_id = p.product_id
       WHERE rp.room_id = ?`,
      [roomId]
    );

    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Truy vấn danh sách sản phẩm
    const [products] = await db.query(
      `SELECT 
          p.*,
          cat.category_name,
          (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) AS comment_count,
          GROUP_CONCAT(DISTINCT col.color_id ORDER BY col.color_id ASC) AS color_ids,
          GROUP_CONCAT(DISTINCT col.color_hex ORDER BY col.color_id ASC) AS color_hexs
        FROM room_product rp
        JOIN product p ON rp.product_id = p.product_id
        LEFT JOIN variant_product vp ON p.product_id = vp.product_id
        LEFT JOIN color col ON vp.color_id = col.color_id
        LEFT JOIN category cat ON p.category_id = cat.category_id
        WHERE rp.room_id = ?
        GROUP BY p.product_id
        ORDER BY p.created_at DESC
        LIMIT ?, ?`,
      [roomId, offset, limit]
    );

    res.json({
      room,
      products,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

    console.log('Returned products:', products.length);
  } catch (error) {
    console.error('Error fetching room products:', error);
    res.status(500).json({ error: 'Failed to fetch room products' });
  }
});


/**
 * @route   POST /api/rooms/:id/products
 * @desc    Thêm sản phẩm vào phòng
 * @access  Private (Admin only)
 * Chưa làm trường hợp nếu sản phẩm đã tồn tại trong phòng thì không thêm vào
 */
router.post('/:slug/products', async (req, res) => {
  try {
    const slug = req.params.slug;
    const { product_ids } = req.body;

    if (!slug) {
      return res.status(400).json({ error: 'Invalid room slug' });
    }

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'Product IDs array is required' });
    }

    // Lấy room_id từ slug
    const [roomRows] = await db.query('SELECT room_id FROM room WHERE slug = ?', [slug]);

    if (roomRows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomId = roomRows[0].room_id;

    // Thêm từng sản phẩm vào phòng
    const addedProducts = [];
    const existingProducts = [];
    const invalidProducts = [];

    for (const productId of product_ids) {
      // Kiểm tra sản phẩm tồn tại
      const [productRows] = await db.query('SELECT product_id FROM product WHERE product_id = ?', [productId]);
      if (productRows.length === 0) {
        invalidProducts.push(productId);
        continue;
      }

      // Kiểm tra nếu đã tồn tại
      const [existing] = await db.query(
        'SELECT 1 FROM room_product WHERE room_id = ? AND product_id = ?',
        [roomId, productId]
      );

      if (existing.length > 0) {
        existingProducts.push(productId);
        return res.status(400).json({ error: `Product ID ${productId} already exists in this room` });
      }

      // Thêm vào room_product
      await db.query(
        'INSERT INTO room_product (room_id, product_id) VALUES (?, ?)',
        [roomId, productId]
      );

      addedProducts.push(productId);
    }

    if (
      addedProducts.length === 0 &&
      existingProducts.length === 0 &&
      invalidProducts.length > 0
    ) {
      return res.status(400).json({ error: 'No products to add or existing or invalid', invalid_products: invalidProducts });
    }


    res.json({
      message: 'Products added to room successfully',
      added_count: addedProducts.length,
      added_products: addedProducts,
      existing_products: existingProducts
    });
  } catch (error) {
    console.error('Error adding products to room:', error);
    res.status(500).json({ error: 'Failed to add products to room' });
  }
});


/**
 * @route   DELETE /api/rooms/:roomId/products/:productId
 * @desc    Xóa sản phẩm khỏi phòng
 * @access  Private (Admin only)
 */
router.delete('/:slug/products/:productId', async (req, res) => {
  try {
    const slug = req.params.slug;
    const productId = Number(req.params.productId);

    if (!slug || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid room slug or product ID' });
    }

    // Lấy room_id từ slug
    const [roomRows] = await db.query('SELECT room_id FROM room WHERE slug = ?', [slug]);

    if (roomRows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomId = roomRows[0].room_id;

    // Kiểm tra liên kết tồn tại
    const [existing] = await db.query(
      'SELECT * FROM room_product WHERE room_id = ? AND product_id = ?',
      [roomId, productId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found in room' });
    }

    // Xóa liên kết
    await db.query(
      'DELETE FROM room_product WHERE room_id = ? AND product_id = ?',
      [roomId, productId]
    );

    res.json({ message: 'Product removed from room successfully' });
  } catch (error) {
    console.error('Error removing product from room:', error);
    res.status(500).json({ error: 'Failed to remove product from room' });
  }
});

module.exports = router; 