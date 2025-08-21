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

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM events ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/admin/:id", verifyToken, isAdmin, async (req, res) => {
  // Thêm middleware bảo vệ
  try {
    const { id } = req.params;
    const [rows] = await db.execute("SELECT * FROM events WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Event not found." });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/admin", verifyToken, isAdmin, async (req, res) => {
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

    // Validate status values
    const validStatuses = ["active", "scheduled", "expired"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status value. Must be one of: active, scheduled, expired.",
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
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tạo sự kiện." });
  }
});

router.put("/admin/:id", verifyToken, isAdmin, async (req, res) => {
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
    // Validate required fields
    if (!title || !start_date || !end_date || !status) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, start_date, end_date, status.",
      });
    }

    // Validate status values
    const validStatuses = ["active", "scheduled", "expired"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status value. Must be one of: active, scheduled, expired.",
      });
    }

    // Check if event exists
    const [existingEvent] = await db.execute(
      "SELECT id FROM events WHERE id = ?",
      [id]
    );
    if (existingEvent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    const [result] = await db.execute(
      `UPDATE events
             SET title = ?, description = ?, image_url = ?, link_url = ?, start_date = ?, end_date = ?, display_order = ?, status = ?, updated_at = NOW()
             WHERE id = ?`,
      [
        title,
        description || null,
        image_url || null,
        link_url || null,
        start_date,
        end_date,
        display_order || 0,
        status,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    res.json({
      success: true,
      message: "Cập nhật sự kiện thành công!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật sự kiện.",
    });
  }
});

// Toggle status: scheduled -> active -> expired -> scheduled
router.put(
  "/admin/:id/toggle-status",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await db.execute(
        "SELECT status FROM events WHERE id = ?",
        [id]
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Event not found." });
      const currentStatus = rows[0].status;
      let newStatus;
      if (currentStatus === "scheduled") newStatus = "active";
      else if (currentStatus === "active") newStatus = "expired";
      else newStatus = "scheduled";
      await db.execute(
        "UPDATE events SET status = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, id]
      );
      res.json({ message: "Event status updated", status: newStatus });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle event status" });
    }
  }
);

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get event image URL before deletion
    const [eventRows] = await db.execute(
      "SELECT image_url FROM events WHERE id = ?",
      [id]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found." });
    }

    const event = eventRows[0];

    // Delete event from database
    const [result] = await db.execute("DELETE FROM events WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Event not found." });
    }

    // Delete image from Cloudinary if exists
    if (event.image_url) {
      try {
        const publicId = extractPublicIdFromUrl(event.image_url);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
          });
        }
      } catch (deleteErr) {
        // Don't fail the request if image deletion fails
      }
    }

    res.json({ message: "Event deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

function extractPublicIdFromUrl(url) {
  if (!url) return null;
  try {
    // Extract public ID from Cloudinary URL
    // Example: https://res.cloudinary.com/xxx/image/upload/v1234567890/SonaSpace/PopupAd/filename.jpg
    const urlParts = url.split("/");
    const uploadIndex = urlParts.indexOf("upload");
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      // Get everything after 'upload/v1234567890/'
      const publicIdParts = urlParts.slice(uploadIndex + 2);
      // Remove file extension
      const publicId = publicIdParts.join("/").replace(/\.[^/.]+$/, "");
      return publicId;
    }
  } catch (error) {
  }
  return null;
}

module.exports = router;
