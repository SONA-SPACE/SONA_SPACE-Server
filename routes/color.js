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
    const [rows] = await db.query(`
      SELECT DISTINCT c.color_id, c.color_name, c.color_hex, c.color_slug
      FROM color c
      JOIN variant_product vp ON c.color_id = vp.color_id
      WHERE vp.product_id = ?
    `, [slug]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching colors by product:", error);
    res.status(500).json({ error: "Failed to fetch colors by product" });
  }
});





module.exports = router;