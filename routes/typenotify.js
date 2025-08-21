const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get("", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM notification_types ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách loại thông báo" });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute("SELECT * FROM notification_types WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy loại thông báo" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy dữ liệu loại thông báo" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { type_code, description, is_active } = req.body;
    if (!type_code) return res.status(400).json({ error: "type_code là bắt buộc" });

    const [result] = await db.execute(
      "INSERT INTO notification_types (type_code, description, is_active) VALUES (?, ?, ?)",
      [type_code, description, is_active ?? 1]
    );

    res.json({ id: result.insertId, message: "Thêm loại thông báo thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi thêm loại thông báo" });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Validate
    if (typeof is_active !== "number" || ![0, 1].includes(is_active)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }

    const [result] = await db.execute(
      "UPDATE notification_types SET is_active = ? WHERE id = ?",
      [is_active, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy loại thông báo" });
    }

    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi cập nhật trạng thái" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type_code, description, is_active } = req.body;

    await db.execute(
      "UPDATE notification_types SET type_code = ?, description = ?, is_active = ? WHERE id = ?",
      [type_code, description, is_active, id]
    );

    res.json({ message: "Cập nhật thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi cập nhật loại thông báo" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có notification nào dùng loại này không
    const [rows] = await db.execute(
      "SELECT COUNT(*) AS count FROM notifications WHERE notification_type_id = ?",
      [id]
    );

    if (rows[0].count > 0) {
      return res
        .status(400)
        .json({ error: "Không thể xóa vì vẫn còn thông báo thuộc loại này" });
    }

    // Nếu không có thì mới xóa
    await db.execute("DELETE FROM notification_types WHERE id = ?", [id]);
    res.json({ message: "Xóa thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi xóa loại thông báo" });
  }
});

module.exports = router; 