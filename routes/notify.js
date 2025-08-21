const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        n.id,
        n.title,
        n.message,
        n.created_by,
        n.created_at,
        n.updated_at,
        nt.type_code,
        nt.description AS type_description
      FROM notifications n
      LEFT JOIN notification_types nt ON n.type_id = nt.id
      ORDER BY n.created_at DESC
    `);

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi lấy danh sách thông báo" });
  }
});
router.get("/admin", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE target = 'admin'
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, content, type, image, status = 1 } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Tiêu đề và nội dung là bắt buộc" });
    }

    const [result] = await db.query(
      `INSERT INTO notifications (title, message, type, image, status, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [title, content, type || "general", image || "", status]
    );

    const notificationId = result.insertId;

    // Lấy danh sách người dùng để gán vào user_notifications
    const [users] = await db.query(`SELECT id FROM users WHERE status = 1`);

    if (users.length > 0) {
      const values = users.map(u => [u.id, notificationId]);
      await db.query(
        `INSERT INTO user_notifications (user_id, notification_id)
         VALUES ?`,
        [values]
      );
    }

    res.status(201).json({ message: "Tạo thông báo thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi máy chủ khi tạo thông báo" });
  }
});
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

  try {
    // 1. Xóa bản ghi liên kết phụ thuộc (nếu có)
    await db.query('DELETE FROM user_notifications WHERE notification_id = ?', [id]);

    // 2. Xóa thông báo chính
    const [result] = await db.query('DELETE FROM notifications WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo để xóa' });
    }

    res.json({ message: 'Xóa thông báo thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi xóa thông báo' });
  }
});

module.exports = router; 