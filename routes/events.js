const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

router.get("/active", async (req, res) => {
  try {
    const now = new Date();
    const nowIso = now.toISOString().slice(0, 19).replace("T", " ");

    const [rows] = await db.execute(
      // Thay đổi: dùng db.execute
      `SELECT id, title, image_url, link_url, description
             FROM events
             WHERE status = 'active'
               AND start_date <= ?
               AND end_date >= ?
             ORDER BY display_order ASC`,
      [nowIso, nowIso]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No active events found." });
    }

    res.json(rows); // Trả về mảng các sự kiện
  } catch (error) {
    console.error("Error fetching active events:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM events ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching all events:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// GET /api/events/:id
// Lấy thông tin chi tiết của một sự kiện cụ thể bằng ID.
// Dùng khi cần chỉnh sửa hoặc xem chi tiết một sự kiện.
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  // Thêm middleware bảo vệ
  try {
    const { id } = req.params;
    const [rows] = await db.execute("SELECT * FROM events WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Event not found." });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching event by ID:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/", verifyToken, isAdmin, async (req, res) => {
  // Thêm middleware bảo vệ
  const {
    title,
    description,
    image_url,
    link_url,
    start_date,
    end_date,
    display_order,
    status,
  } = req.body;
  try {
    if (!title || !start_date || !end_date || !status) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, start_date, end_date, status.",
      });
    }

    const [result] = await db.execute(
      `INSERT INTO events (title, description, image_url, link_url, start_date, end_date, display_order, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        title,
        description || null,
        image_url || null,
        link_url || null,
        start_date,
        end_date,
        display_order || 0,
        status,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Tạo sự kiện thành công.",
      event_id: result.insertId,
    });
  } catch (err) {
    console.error("Error creating event:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tạo sự kiện." });
  }
});

router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  // Thêm middleware bảo vệ
  const { id } = req.params;
  const {
    title,
    description,
    image_url,
    link_url,
    start_date,
    end_date,
    display_order,
    status,
  } = req.body;
  try {
    const [result] = await db.execute(
      `UPDATE events
             SET title = ?, description = ?, image_url = ?, link_url = ?, start_date = ?, end_date = ?, display_order = ?, status = ?
             WHERE id = ?`,
      [
        title,
        description,
        image_url,
        link_url,
        start_date,
        end_date,
        display_order,
        status,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Event not found." });
    }
    res.json({ message: "Event updated successfully!" });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  // Thêm middleware bảo vệ
  const { id } = req.params;
  try {
    const [result] = await db.execute("DELETE FROM events WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Event not found." });
    }
    res.json({ message: "Event deleted successfully!" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
