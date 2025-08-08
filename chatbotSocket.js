// SOCKET.IO dùng cho chat bot
const { Server } = require("socket.io");
const { OpenAI } = require("openai");
const db = require("./config/database");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = function attachChatbotSocket(server) {
  const io = new Server(server, { cors: { origin: "*" } });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const chatHistories = {};

  // kết nối socket
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    chatHistories[socket.id] = [];

    // tin nhắn từ người dùng
    socket.on("user_message", async (msg) => {
      try {
        const [rows] = await db.query(
          "SELECT context_text FROM chatbot_context LIMIT 1"
        );
        const systemPrompt = {
          role: "system",
          content:
            rows[0]?.context_text ||
            "Bạn là trợ lý AI thân thiện, chuyên hỗ trợ cho website này.",
        };

        // lịch sử chat
        chatHistories[socket.id].push({ role: "user", content: msg });

        const messages = [systemPrompt, ...chatHistories[socket.id].slice(-5)];
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: messages,
          max_tokens: 512,
          temperature: 0.7,
        });
        const reply = completion.choices[0].message.content;
        chatHistories[socket.id].push({ role: "assistant", content: reply });
        socket.emit("bot_reply", `${reply}`);
      } catch (error) {
        console.error("Error in chat:", error);
        socket.emit("bot_reply", `Lỗi khi xử lý tin nhắn`);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      delete chatHistories[socket.id];
    });
  });
};
