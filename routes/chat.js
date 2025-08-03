const express = require("express");
const router = express.Router();

// Nếu dùng OpenAI, import ở đây
// const { OpenAI } = require("openai");
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Demo trả lời giả lập (replace bằng call AI nếu muốn)
    // Nếu muốn gọi OpenAI, thay đoạn này
    // const completion = await openai.chat.completions.create({
    //   model: "gpt-3.5-turbo",
    //   messages: [{ role: "user", content: message }],
    // });
    // const reply = completion.choices[0].message.content;
    const reply = `Bot: Bạn vừa nói "${message}"`;

    return res.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
