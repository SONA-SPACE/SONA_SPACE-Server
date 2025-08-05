const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/", async (req, res) => {
  try {
    const sql = `SELECT * from chatbot_context LIMIT 1`;
    const [result] = await db.query(sql);
    const context = result[0].context_text;
    res.json({ context });
  } catch (error) {
    console.error("Có lỗi với bảng chat_context:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
});

router.put("/context", async (req, res) => {
  try {
    const { context } = req.body;
    if (!context)
      return res.status(400).json({ error: "Vui lòng nhập nội dung" });
    if (context.length > 2000) {
      return res
        .status(400)
        .json({ error: "Nội dung quá dài, vui lòng nhập ít hơn 2000 ký tự" });
    }
    const sql = `UPDATE chatbot_context SET context_text = ? WHERE id = 1`;
    const [result] = await db.query(sql, [context]);
    res.status(201).json({
      message: "Cập nhật thành công.",
      context: context,
    });
  } catch (error) {
    console.error("Có lỗi với bảng chat_context:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
});

// router.post("/context", async (req, res) => {
//   try {
//     const { context } = req.body;
//     if (!context) return res.status(400).json({ error: "Vui lòng nhập nội dung" });
//     if (context.length > 2000) {
//       return res.status(400).json({ error: "Nội dung quá dài, vui lòng nhập ít hơn 2000 ký tự" });
//     }
//     const sql = `INSERT INTO chatbot_context (context_text) VALUES (?)`;
//     const [result] = await db.query(sql, [context]);
//     res.json({ success: true, id: result.insertId });
//   } catch (error) {
//     console.error("Có lỗi với bảng chat_context:", error);
//     return res.status(500).json({ error: "Lỗi server" });
//   }
// });

module.exports = router;
