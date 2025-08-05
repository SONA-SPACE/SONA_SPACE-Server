const express = require("express");
const router = express.Router();

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Vui lòng nhập tin nhắn" });
    if (message.length > 500) {
      return res.status(400).json({ error: "Tin nhắn quá dài" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
      max_tokens: 512,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    return res.json({ reply });
  } catch (error) {
    console.error("Chat API đang có lỗi:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
