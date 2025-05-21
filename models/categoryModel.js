const express = require("express");
const router = express.Router();
const db = require("../config/database");

//Get All Categories
router.get("/", (req, res) => {
  let sql = `SELECT * FROM loai WHERE an_hien = 1 ORDER BY thu_tu ASC`;
  db.query(sql, (err, data) => {
    if (err) {
      console.error("Error fetching categories: " + err);
      return res.status(500).json({ error: "Failed to fetch categories" });
    }
    res.json(data);
  });
});
//Get Category By ID
router.get("/:id", (req, res) => {
  let id = Number(req.params.id);
  if (isNaN(id)) {
    console.error("Invalid category ID");
    return res.status(400).json({ error: "Invalid category ID" });
  }
  let sql = `SELECT * FROM loai WHERE id = ? AND an_hien = 1`;
  db.query(sql, [id], (err, data) => {
    if (err) {
      console.error("Error fetching category by ID: " + err);
      return res.status(500).json({ error: "Failed to fetch category" });
    }
    if (!data.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(data);
  });
});
module.exports = router;
