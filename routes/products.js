const express = require("express");
const router = express.Router();
const db = require("../config/database");

const LIMIT_ALL_PRODUCT = 9;
router.get("/", async (req, res) => {
  try {
    const sql = `SELECT * FROM products LIMIT 0,${LIMIT_ALL_PRODUCT}`;
    const [products] = await db.query(sql);
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
router.get("/:id", async (req, res) => {
  let id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });
  try{
    const sql = `SELECT * FROM products WHERE id = ${req.params.id}`;
    const [product] = await db.query(sql);
    res.json(product[0]);
  }catch(error){
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
})
module.exports = router;