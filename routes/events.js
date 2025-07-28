// routes/eventRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/database"); // Thay đổi: Sử dụng 'db' từ config/database
const { verifyToken, isAdmin } = require("../middleware/auth"); // Import middleware xác thực và phân quyền
const cloudinary = require("cloudinary").v2; // Import Cloudinary nếu có nhu cầu tải ảnh lên

// ====================================================================
// API CHO FRONTEND POPUP (PopupAd.jsx)
// ====================================================================

// GET /api/events/active
// Lấy danh sách các sự kiện đang hoạt động và còn hiệu lực, sắp xếp theo display_order.
// Dùng cho carousel popup trên trang người dùng. API này không cần bảo vệ.
router.get("/active", async (req, res) => {
  try {
    const now = new Date();
    const nowIso = now.toISOString().slice(0, 19).replace("T", " "); // Format YYYY-MM-DD HH:MM:SS

    const [rows] = await db.execute(
      // Thay đổi: dùng db.execute
      `SELECT id, title, image_url, link_url, description
             FROM events
             WHERE status = 'active'
               AND start_date <= ?
               AND end_date >= ?
             ORDER BY display_order ASC`, // Sắp xếp theo display_order
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

// ====================================================================
// API CHO TRANG ADMIN (Quản lý Events) - Cần bảo vệ bằng middleware
// ====================================================================

// GET /api/events
// Lấy tất cả các sự kiện từ database.
// Có thể hỗ trợ phân trang, tìm kiếm, lọc theo trạng thái, và sắp xếp.
router.get("/", verifyToken, isAdmin, async (req, res) => {
  // Thêm middleware bảo vệ
  try {
    // Để đơn giản, ban đầu chỉ lấy tất cả.
    // Logic phân trang, tìm kiếm, lọc, sắp xếp sẽ phức tạp hơn nếu thêm vào đây.
    const [rows] = await db.execute(
      "SELECT * FROM events ORDER BY created_at DESC"
    ); // Thay đổi: dùng db.execute
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
    const [rows] = await db.execute("SELECT * FROM events WHERE id = ?", [id]); // Thay đổi: dùng db.execute

    if (rows.length === 0) {
      return res.status(404).json({ message: "Event not found." });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching event by ID:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// POST /api/events
// Tạo một sự kiện mới trong database.
// Dữ liệu sự kiện được gửi trong body của request.
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

    // Logic tải ảnh lên Cloudinary sẽ được thêm ở đây nếu cần
    // Ví dụ: if (req.files && req.files.image) { const result = await cloudinary.uploader.upload(req.files.image.tempFilePath); image_url = result.secure_url; }

    const [result] = await db.execute(
      // Thay đổi: dùng db.execute
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

// PUT /api/events/:id
// Cập nhật thông tin của một sự kiện đã tồn tại bằng ID.
// Dữ liệu cập nhật được gửi trong body của request.
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
    // Logic tải ảnh lên Cloudinary sẽ được thêm ở đây nếu cần
    // Ví dụ: if (req.files && req.files.image) { const result = await cloudinary.uploader.upload(req.files.image.tempFilePath); image_url = result.secure_url; }

    const [result] = await db.execute(
      // Thay đổi: dùng db.execute
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

// DELETE /api/events/:id
// Xóa một sự kiện khỏi database bằng ID.
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  // Thêm middleware bảo vệ
  const { id } = req.params;
  try {
    const [result] = await db.execute("DELETE FROM events WHERE id = ?", [id]); // Thay đổi: dùng db.execute

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
