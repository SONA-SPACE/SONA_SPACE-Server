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
 * @route   GET /api/rooms/:id
 * @desc    Lấy thông tin một phòng
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const [rooms] = await db.query(`
      SELECT 
        r.*, 
        (SELECT COUNT(*) FROM room_product rp WHERE rp.room_id = r.room_id) as product_count
      FROM room r
      WHERE r.room_id = ?
    `, [id]);
    
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
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, image } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }
    
    // Kiểm tra tên phòng đã tồn tại chưa
    const [existingRooms] = await db.query('SELECT room_id FROM room WHERE room_name = ?', [name]);
    
    if (existingRooms.length > 0) {
      return res.status(400).json({ error: 'Room name already exists' });
    }
    
    const [result] = await db.query(
      'INSERT INTO room (room_name, room_description, created_at) VALUES (?, ?, NOW())',
      [name, description || null]
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
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const { name, description } = req.body;
    
    // Kiểm tra phòng tồn tại
    const [existingRoom] = await db.query('SELECT room_id FROM room WHERE room_id = ?', [id]);
    
    if (existingRoom.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Kiểm tra tên mới có trùng với phòng khác không
    if (name) {
      const [duplicateName] = await db.query(
        'SELECT room_id FROM room WHERE room_name = ? AND room_id != ?',
        [name, id]
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
      WHERE room_id = ?
    `, [name || null, description || null, id]);
    
    const [updatedRoom] = await db.query('SELECT * FROM room WHERE room_id = ?', [id]);
    
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
 * @route   DELETE /api/rooms/:id
 * @desc    Xóa phòng
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    // Kiểm tra phòng tồn tại
    const [existingRoom] = await db.query('SELECT room_id FROM room WHERE room_id = ?', [id]);
    
    if (existingRoom.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Xóa các liên kết với sản phẩm
    await db.query('DELETE FROM room_product WHERE room_id = ?', [id]);
    
    // Xóa phòng
    await db.query('DELETE FROM room WHERE room_id = ?', [id]);
    
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
router.get('/:id/products', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;
    
    // Kiểm tra phòng tồn tại
    const [room] = await db.query('SELECT * FROM room WHERE room_id = ?', [id]);
    
    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Đếm tổng số sản phẩm
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total
      FROM room_product rp
      JOIN product p ON rp.product_id = p.product_id
      WHERE rp.room_id = ?
    `, [id]);
    
    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);
    
    // Lấy sản phẩm trong phòng
    const [products] = await db.query(`
      SELECT 
        p.*,
        c.category_name,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
        (SELECT AVG(rating) FROM comment WHERE product_id = p.product_id) as average_rating
      FROM room_product rp
      JOIN product p ON rp.product_id = p.product_id
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE rp.room_id = ?
      ORDER BY p.created_at DESC
      LIMIT ?, ?
    `, [id, offset, limit]);
    
    res.json({
      room: room[0],
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
  } catch (error) {
    console.error('Error fetching room products:', error);
    res.status(500).json({ error: 'Failed to fetch room products' });
  }
});

/**
 * @route   POST /api/rooms/:id/products
 * @desc    Thêm sản phẩm vào phòng
 * @access  Private (Admin only)
 */
router.post('/:id/products', verifyToken, isAdmin, async (req, res) => {
  try {
    const roomId = Number(req.params.id);
    const { product_ids } = req.body;
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'Product IDs array is required' });
    }
    
    // Kiểm tra phòng tồn tại
    const [room] = await db.query('SELECT room_id FROM room WHERE room_id = ?', [roomId]);
    
    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Thêm từng sản phẩm vào phòng
    const addedProducts = [];
    const existingProducts = [];
    
    for (const productId of product_ids) {
      // Kiểm tra sản phẩm tồn tại
      const [product] = await db.query('SELECT product_id FROM product WHERE product_id = ?', [productId]);
      
      if (product.length === 0) {
        continue; // Bỏ qua sản phẩm không tồn tại
      }
      
      // Kiểm tra liên kết đã tồn tại chưa
      const [existing] = await db.query(
        'SELECT * FROM room_product WHERE room_id = ? AND product_id = ?', 
        [roomId, productId]
      );
      
      if (existing.length > 0) {
        existingProducts.push(productId);
        continue;
      }
      
      // Thêm liên kết
      await db.query(
        'INSERT INTO room_product (room_id, product_id) VALUES (?, ?)',
        [roomId, productId]
      );
      
      addedProducts.push(productId);
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
router.delete('/:roomId/products/:productId', verifyToken, isAdmin, async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const productId = Number(req.params.productId);
    
    if (isNaN(roomId) || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid room ID or product ID' });
    }
    
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