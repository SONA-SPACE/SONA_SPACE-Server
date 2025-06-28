const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const [rows] = await db.query("SELECT ...");

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
  
// GET /api/color/by-product/:slug
/**
 * @route   GET /api/color/by-product/:slug
 * @desc    Lấy danh sách màu sắc theo sản phẩm
 * @access  Public
 */
router.get('/by-product/:slug', async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ error: "Missing product slug" });
  try {
    const [productRows] = await db.query(
      `SELECT id FROM product WHERE slug = ? LIMIT 1`, [slug]
    );
    if (!productRows.length) {   
      return res.status(404).json({ error: "Product not found" });
    }
    const productId = productRows[0].id; 
    const [rows] = await db.query(`
      SELECT DISTINCT c.color_id, c.color_name, c.color_hex, c.color_slug
      FROM color c
      JOIN variant_product vp ON c.color_id = vp.color_id
      WHERE vp.product_id = ?
    `, [productId]);
    res.json(rows);
  } 
  catch (err) {
  res.status(500).json({ 
    error: "Failed to fetch colors by product", 
    message: err.message, 
    stack: err.stack 
  });
}
});

