const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/", async (req, res) => {
  try {
    const sql = `SELECT * FROM product_categories`;
    const [categories] = await db.query(sql);
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
router.get("/:id", async (req, res) => {
  let id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });
  try {
    const sql = `SELECT * FROM product_categories WHERE id = ${id}`;
    const [category] = await db.query(sql);
    res.json(category[0]);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

module.exports = router;
