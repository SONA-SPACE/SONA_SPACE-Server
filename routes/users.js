const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách người dùng (chỉ admin)
 * @access  Private (Admin)
 */
router.get('/', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search;

    // Tìm kiếm người dùng nếu có tham số search
    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = 'WHERE user_gmail LIKE ? OR user_name LIKE ? OR user_number LIKE ?';
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    // Đếm tổng số người dùng
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM user ${whereClause}`,
      params
    );

    const totalUsers = countResult[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    // Lấy danh sách người dùng với phân trang
    const [users] = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at 
       FROM user ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?, ?`,
      [...params, offset, limit]
    );

    // Định dạng lại kết quả
    const formattedUsers = users.map(user => ({
      id: user.user_id,
      email: user.user_gmail,
      full_name: user.user_name,
      phone: user.user_number,
      address: user.user_address,
      role: user.user_role,
      created_at: user.created_at,
      updated_at: user.updated_at
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        usersPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
router.get("/simple", verifyToken, isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT user_id AS id, user_name AS name, user_gmail AS email
      FROM user
      WHERE user_role = 'user'
    `);
    res.json(users);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách user:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy danh sách người dùng" });
  }
});
// 💥 Đặt trước route chứa /:id
router.get('/admin', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        user_id,
        user_name,
        user_gmail,
        user_number,
        user_image,
        user_address,
        user_role,
        user_gender,
        user_birth,
        user_email_active,
        created_at,
        updated_at
      FROM user
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);

    const today = new Date();

    const users = rows.map(user => {
      const createdAt = new Date(user.created_at);
      const updatedAt = new Date(user.updated_at);
      const birth = user.user_birth ? new Date(user.user_birth) : null;
      const diffDays = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24));

      return {
        ...user,

        user_birth: birth ? birth.toLocaleDateString('vi-VN') : '',
        user_category: diffDays <= 30 ? 'Khách hàng mới' : 'Khách hàng cũ'
      };
    });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách người dùng' });
  }
});
router.get('/admin/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'ID không hợp lệ' });

    const [users] = await db.query(`
      SELECT 
        user_id, user_name, user_gmail, user_number, user_image, user_address,
        user_role, user_gender, user_birth, user_email_active, user_verified_at, user_disabled_at,
        created_at, updated_at
      FROM user
      WHERE user_id = ? AND deleted_at IS NULL
    `, [userId]);

    if (users.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const user = users[0];
    const today = new Date();
    const createdAt = new Date(user.created_at);
    const diffDays = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24));

    res.json({
      id: user.user_id,
      full_name: user.user_name,
      email: user.user_gmail,
      phone: user.user_number,
      image: user.user_image,
      address: user.user_address,
      role: user.user_role,
      gender: user.user_gender,
      birth: user.user_birth,
      email_active: user.user_email_active,
      verified_at: user.user_verified_at,
      disabled_at: user.user_disabled_at || '-',
      created_at: user.created_at,
      updated_at: user.updated_at,
      purchasedProducts: 0,
      category: diffDays <= 30 ? 'Khách hàng mới' : 'Khách hàng cũ'
    });

  } catch (err) {
    console.error('Lỗi lấy người dùng:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});
router.put("/admin/:id", upload.single("image"), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: "ID không hợp lệ" });

    const {
      user_name,
      user_number,
      user_gender,
      user_birth,
      user_role,
      user_address,
      user_email_active,
      user_verified_at,
      user_disabled_at,
      remove_image,
    } = req.body;

    let imageUrl;

    // Nếu có ảnh mới được upload
    if (req.file) {
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(base64Image, {
        folder: "SonaSpace/User",
      });
      imageUrl = result.secure_url;

      // Xoá ảnh cũ nếu muốn (tùy chọn)
      const [oldRows] = await db.query("SELECT user_image FROM user WHERE user_id = ?", [userId]);
      const oldImage = oldRows[0]?.user_image;
      if (oldImage) {
        const publicId = oldImage.split('/').slice(-1)[0].split('.')[0];
        await cloudinary.uploader.destroy(`SonaSpace/User/${publicId}`);
      }
    } else if (remove_image === '1') {
      imageUrl = null;
    } else {
      const [rows] = await db.query("SELECT user_image FROM user WHERE user_id = ?", [userId]);
      imageUrl = rows[0]?.user_image || null;
    }

    const [result] = await db.query(
      `UPDATE user SET 
        user_name = ?, 
        user_number = ?, 
        user_gender = ?, 
        user_birth = ?, 
        user_role = ?, 
        user_address = ?, 
        user_email_active = ?, 
        user_verified_at = ?, 
        user_disabled_at = ?, 
        user_image = ?, 
        updated_at = NOW()
      WHERE user_id = ?`,
      [
        user_name || null,
        user_number || null,
        user_gender || null,
        user_birth || null,
        user_role || null,
        user_address || null,
        user_email_active || 0,
        user_verified_at || null,
        user_disabled_at || null,
        imageUrl,
        userId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({ message: "Cập nhật người dùng thành công" });
  } catch (error) {
    console.error("Lỗi cập nhật user:", error);
    res.status(500).json({ error: "Lỗi server", detail: error.message });
  }
});





/**
 * @route   GET /api/users/:id
 * @desc    Lấy thông tin người dùng theo ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem thông tin
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to view this user' });
    }

    const [users] = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at 
       FROM user WHERE user_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Định dạng lại kết quả
    const user = {
      id: users[0].user_id,
      email: users[0].user_gmail,
      full_name: users[0].user_name,
      phone: users[0].user_number,
      address: users[0].user_address,
      role: users[0].user_role,
      created_at: users[0].created_at,
      updated_at: users[0].updated_at
    };

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Cập nhật thông tin người dùng
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được cập nhật thông tin
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to update this user' });
    }

    const { full_name, phone, address, password, role } = req.body;

    // Kiểm tra người dùng tồn tại
    const [existingUser] = await db.query('SELECT * FROM user WHERE user_id = ?', [userId]);

    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Chỉ admin mới được cập nhật quyền
    let updatedRole = existingUser[0].user_role;
    if (role && req.user.role === 'admin') {
      updatedRole = role;
    }

    // Tạo đối tượng chứa dữ liệu cập nhật
    const updateData = {
      user_name: full_name || existingUser[0].user_name,
      user_number: phone !== undefined ? phone : existingUser[0].user_number,
      user_address: address !== undefined ? address : existingUser[0].user_address,
      user_role: updatedRole,
      updated_at: new Date()
    };

    // Cập nhật mật khẩu nếu có
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.user_password = await bcrypt.hash(password, salt);
    }

    // Cập nhật thông tin người dùng
    await db.query(
      `UPDATE user SET
        user_name = ?,
        user_number = ?,
        user_address = ?,
        ${password ? 'user_password = ?,' : ''}
        user_role = ?,
        updated_at = NOW()
      WHERE user_id = ?`,
      password
        ? [updateData.user_name, updateData.user_number, updateData.user_address, updateData.user_password, updateData.user_role, userId]
        : [updateData.user_name, updateData.user_number, updateData.user_address, updateData.user_role, userId]
    );

    // Lấy thông tin người dùng đã cập nhật
    const [updatedUser] = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at 
       FROM user WHERE user_id = ?`,
      [userId]
    );

    // Định dạng lại kết quả
    const formattedUser = {
      id: updatedUser[0].user_id,
      email: updatedUser[0].user_gmail,
      full_name: updatedUser[0].user_name,
      phone: updatedUser[0].user_number,
      address: updatedUser[0].user_address,
      role: updatedUser[0].user_role,
      created_at: updatedUser[0].created_at,
      updated_at: updatedUser[0].updated_at
    };

    res.json({
      message: 'User updated successfully',
      user: formattedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa người dùng
 * @access  Private (Admin)
 */
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Kiểm tra người dùng tồn tại
    const [existingUser] = await db.query('SELECT * FROM user WHERE user_id = ?', [userId]);

    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Không thể xóa chính mình
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Kiểm tra xem người dùng có đơn hàng không
    const [orders] = await db.query('SELECT order_id FROM `order` WHERE user_id = ? LIMIT 1', [userId]);

    if (orders.length > 0) {
      // Nếu có đơn hàng, đánh dấu là không hoạt động thay vì xóa
      // Giả sử có cột user_email_active làm dấu hiệu cho hoạt động
      await db.query('UPDATE user SET user_email_active = 0 WHERE user_id = ?', [userId]);
      return res.json({ message: 'User has been deactivated instead of deleted due to existing orders' });
    }

    // Xóa các bản ghi liên quan
    await db.query('DELETE FROM wishlist WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM comment WHERE user_id = ?', [userId]);

    // Xóa người dùng
    await db.query('DELETE FROM user WHERE user_id = ?', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * @route   GET /api/users/:id/orders
 * @desc    Lấy danh sách đơn hàng của người dùng
 * @access  Private
 */
router.get('/:id/orders', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem đơn hàng
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to view these orders' });
    }

    // Kiểm tra người dùng tồn tại
    const [existingUser] = await db.query('SELECT user_id FROM user WHERE user_id = ?', [userId]);

    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Lấy danh sách đơn hàng
    const [orders] = await db.query(`
      SELECT 
        o.*,
        os.order_status_name as status_name
      FROM \`order\` o
      LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [userId]);

    // Lấy chi tiết cho mỗi đơn hàng
    for (let i = 0; i < orders.length; i++) {
      // Lấy thông tin thanh toán
      const [payments] = await db.query(`
        SELECT * FROM payment WHERE order_id = ?
      `, [orders[i].order_id]);

      if (payments.length > 0) {
        orders[i].payment = payments[0];
      }

      // Lấy thông tin các sản phẩm trong đơn hàng
      const [orderItems] = await db.query(`
        SELECT 
          oi.*,
          p.product_name,
          p.product_image
        FROM order_items oi
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
      `, [orders[i].order_id]);

      orders[i].items = orderItems;
      orders[i].total_items = orderItems.length;
    }

    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Failed to fetch user orders' });
  }
});

/**
 * @route   GET /api/users/:id/wishlist
 * @desc    Lấy danh sách wishlist của người dùng
 * @access  Private
 */
router.get('/:id/wishlist', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem wishlist
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to view this wishlist' });
    }

    // Lấy danh sách wishlist với thông tin sản phẩm
    const [wishlist] = await db.query(`
      SELECT 
        w.wishlist_id,
        w.created_at,
        w.updated_at,
        p.*,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) as average_rating
      FROM wishlist w
      JOIN product p ON w.product_id = p.product_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `, [userId]);

    res.json(wishlist);
  } catch (error) {
    console.error('Error fetching user wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch user wishlist' });
  }
});

/**
 * @route   GET /api/users/:id/reviews
 * @desc    Lấy danh sách đánh giá sản phẩm của người dùng
 * @access  Private
 */
router.get('/:id/reviews', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem đánh giá
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to view these reviews' });
    }

    // Lấy danh sách đánh giá với thông tin sản phẩm
    const [reviews] = await db.query(`
      SELECT 
        c.*,
        p.product_name,
        p.product_image,
        p.product_price
      FROM comment c
      JOIN product p ON c.product_id = p.product_id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `, [userId]);

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ error: 'Failed to fetch user reviews' });
  }
});






module.exports = router;
