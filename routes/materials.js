const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET tất cả vật liệu (chưa bị xóa)
router.get("/", async (req, res) => {
  const sql = `
    SELECT material_id, material_name, material_description, slug,
           material_priority, material_status, created_at, updated_at
    FROM materials
    WHERE deleted_at IS NULL
    ORDER BY material_priority ASC, created_at DESC
  `;
  try {
    const [results] = await db.query(sql);
    res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching materials:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách vật liệu.",
    });
  }
});

// GET chi tiết vật liệu theo slug
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  const sql = `
    SELECT material_id, material_name, material_description, slug,
           material_priority, material_status, created_at, updated_at
    FROM materials
    WHERE slug = ? AND deleted_at IS NULL
  `;
  try {
    const [results] = await db.query(sql, [slug]);
    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Vật liệu không tìm thấy." });
    }
    res.status(200).json({ success: true, material: results[0] });
  } catch (err) {
    console.error("Error fetching material by slug:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy vật liệu.",
    });
  }
});

// POST thêm mới vật liệu
router.post("/", async (req, res) => {
  const {
    material_name,
    material_description = null,
    slug,
    material_priority = 1,
    material_status = 1,
  } = req.body;

  if (!material_name || !slug) {
    return res.status(400).json({
      success: false,
      message: "Tên vật liệu và slug là bắt buộc.",
    });
  }

  const sql = `
    INSERT INTO materials (
      material_name, material_description, slug,
      material_priority, material_status
    ) VALUES (?, ?, ?, ?, ?)
  `;
  try {
    const [result] = await db.query(sql, [
      material_name,
      material_description,
      slug,
      material_priority,
      material_status,
    ]);
    res.status(201).json({
      success: true,
      message: "Vật liệu đã được thêm thành công.",
      material: {
        material_id: result.insertId,
        material_name,
        material_description,
        slug,
        material_priority,
        material_status,
        created_at: new Date(),
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Slug hoặc tên vật liệu đã tồn tại.",
      });
    }
    console.error("Error adding new material:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi thêm vật liệu mới.",
    });
  }
});

// PUT cập nhật vật liệu
router.put("/:slug", async (req, res) => {
  const oldSlug = req.params.slug;
  const {
    material_name,
    material_description = null,
    slug: newSlug,
    material_priority,
    material_status,
  } = req.body;

  if (!material_name || !newSlug) {
    return res.status(400).json({
      success: false,
      message: "Tên vật liệu và slug mới là bắt buộc.",
    });
  }

  try {
    const [materialToUpdate] = await db.query(
      "SELECT material_id FROM materials WHERE slug = ? AND deleted_at IS NULL",
      [oldSlug]
    );
    if (materialToUpdate.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Vật liệu không tìm thấy để cập nhật.",
      });
    }

    const updateSql = `
      UPDATE materials
      SET material_name = ?, material_description = ?, slug = ?,
          material_priority = ?, material_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE material_id = ?
    `;
    const [result] = await db.query(updateSql, [
      material_name,
      material_description,
      newSlug,
      material_priority,
      material_status,
      materialToUpdate[0].material_id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Không có thay đổi hoặc vật liệu không tồn tại.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vật liệu đã được cập nhật thành công.",
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Slug mới đã tồn tại cho một vật liệu khác.",
      });
    }
    console.error("Error updating material:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật vật liệu.",
    });
  }
});

// DELETE vật liệu (xóa mềm)
router.delete("/:slug", async (req, res) => {
  const { slug } = req.params;
  const sql = `
    UPDATE materials
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE slug = ? AND deleted_at IS NULL
  `;
  try {
    const [result] = await db.query(sql, [slug]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Vật liệu không tìm thấy để xóa.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Vật liệu đã được xóa thành công (xóa mềm).",
    });
  } catch (err) {
    console.error("Error deleting material:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa vật liệu.",
    });
  }
});

module.exports = router;
