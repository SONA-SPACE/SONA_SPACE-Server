const express = require("express");
const router = express.Router();
const db = require("../config/database");

//Get all products
const LIMIT_ALL_PRODUCT = 9;
router.get("/", async (req, res) => {
  try {
    const sql = `SELECT * FROM san_pham WHERE an_hien = 1 ORDER BY ngay ASC LIMIT 0,${LIMIT_ALL_PRODUCT}`;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

//Get Hot Product
const LIMIT_HOT_PRODUCT = 9;
router.get("/hot", async (req, res) => {
  try {
    const sql = `SELECT * FROM san_pham WHERE an_hien = 1 AND hot = 1 ORDER BY ngay DESC LIMIT 0,${LIMIT_HOT_PRODUCT}`;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching hot products:", err);
    res.status(500).json({ error: "Failed to fetch hot products" });
  }
});

//GET product By ID
const LIMIT_PRODUCT_BYID = 9;
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const sql = `SELECT * FROM san_pham WHERE id_loai = ? AND an_hien = 1 ORDER BY ngay ASC LIMIT 0,${LIMIT_PRODUCT_BYID}`;
    const [rows] = await db.query(sql, [id]);

    if (!rows.length) {
      return res
        .status(404)
        .json({ error: "No products found for this category" });
    }
    res.json(rows);
  } catch (err) {
    console.error("Error fetching products by ID:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

module.exports = router;
