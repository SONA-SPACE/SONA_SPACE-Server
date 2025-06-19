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
  


module.exports = router;