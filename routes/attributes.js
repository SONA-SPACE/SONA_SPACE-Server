const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

router.post("/:categoryId", async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const { attribute_name, value_type, unit, is_required } = req.body;

    if (!categoryId || isNaN(categoryId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID danh mục không hợp lệ." });
    }

    if (!attribute_name || !value_type) {
      return res.status(400).json({
        success: false,
        message: "Tên và kiểu giá trị thuộc tính là bắt buộc.",
      });
    }

    const sql = `
      INSERT INTO attributes (category_id, attribute_name, value_type, unit, is_required, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(sql, [
      categoryId,
      attribute_name,
      value_type,
      unit || null,
      is_required ? 1 : 0,
    ]);

    res.status(201).json({
      success: true,
      message: "Tạo thuộc tính thành công.",
      attribute_id: result.insertId,
    });
  } catch (err) {
    console.error("Error creating attribute:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tạo thuộc tính." });
  }
});

module.exports = router;
