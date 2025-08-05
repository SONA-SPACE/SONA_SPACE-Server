const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

/**
 * @route   GET /api/color
 * @desc    Lấy tất cả danh mục sản phẩm
 * @access  Public
 */
router.get("/filter", async (req, res) => {
  const [rows] = await db.query(`
      SELECT color_id, color_name, color_hex
      FROM color
      ORDER BY color_priority ASC
    `);
  res.json(rows);
});

/**
 * @route   GET /api/color/by-product/:slug
 * @desc    Lấy danh sách màu sắc theo sản phẩm
 * @access  Public
 */
router.get("/by-product/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const [rows] = await db.query(
      `
      SELECT DISTINCT c.color_id, c.color_name, c.color_hex, c.color_slug
      FROM color c
      JOIN variant_product vp ON c.color_id = vp.color_id
      WHERE vp.product_id = ?
    `,
      [slug]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching colors by product:", error);
    res.status(500).json({ error: "Failed to fetch colors by product" });
  }
});

router.get("/admin", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.color_id,
        c.color_hex,
        c.color_name,
        c.color_priority,
        c.color_slug,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        c.status,
        COUNT(DISTINCT vp.product_id) AS product_count
      FROM color c
      LEFT JOIN variant_product vp ON c.color_id = vp.color_id
      GROUP BY c.color_id
      ORDER BY c.color_priority ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching all colors for admin:", error);
    res.status(500).json({ error: "Failed to fetch all colors" });
  }
});
router.get("/admin/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ message: "Slug is required" });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT 
        color_id, 
        color_name, 
        color_hex, 
        color_slug, 
        color_priority, 
        status,
        created_at,
        updated_at,
        deleted_at
      FROM color
      WHERE color_slug = ?
      LIMIT 1
    `,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching color by slug:", error);
    res.status(500).json({ error: "Failed to fetch color" });
  }
});
router.post("/admin", async (req, res) => {
  const { color_hex, color_name, color_priority, color_slug } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!color_name || !color_hex) {
    return res
      .status(400)
      .json({ message: "color_name and color_hex are required" });
  }

  try {
    const [result] = await db.query(
      `
      INSERT INTO color (color_hex, color_name, color_priority, color_slug)
      VALUES (?, ?, ?, ?)
    `,
      [color_hex, color_name, color_priority || 0, color_slug]
    );
    res.status(201).json({
      message: "Color created successfully",
      color_id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating new color:", error);
    res.status(500).json({ error: "Failed to create new color" });
  }
});
router.put("/admin/:id", async (req, res) => {
  const colorId = req.params.id;
  const { color_hex, color_name, color_priority, color_slug, status } =
    req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!colorId) {
    return res.status(400).json({ message: "Color ID is required" });
  }

  try {
    const [result] = await db.query(
      `
      UPDATE color
      SET color_hex = ?, color_name = ?, color_priority = ?, color_slug = ?, status = ?
      WHERE color_id = ?
    `,
      [color_hex, color_name, color_priority, color_slug, status, colorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json({ message: "Color updated successfully" });
  } catch (error) {
    console.error("Error updating color:", error);
    res.status(500).json({ error: "Failed to update color" });
  }
});
router.delete("/admin/:id", async (req, res) => {
  const colorId = req.params.id;

  if (!colorId) {
    return res.status(400).json({ message: "Color ID is required" });
  }

  try {
    // Soft delete: Cập nhật cột deleted_at
    const [result] = await db.query(
      `
      UPDATE color
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE color_id = ?
    `,
      [colorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json({ message: "Color soft-deleted successfully" });
  } catch (error) {
    console.error("Error soft-deleting color:", error);
    res.status(500).json({ error: "Failed to soft-delete color" });
  }
});
module.exports = router;
