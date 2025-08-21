// SOCKET.IO cho Gemini 2.5 Pro với Google Search + Context
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("./config/database");
require("dotenv").config();

const MAX_IMAGE_MB = 5;

// Giới hạn lịch sử để tránh prompt nặng
const MAX_TURNS = 12; // mỗi turn = 1 user + 1 model

module.exports = function attachChatbotSocketGemini25(io) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Tools cho Gemini 2.5 Pro (Grounding)
  const tools = [{ googleSearch: {} }];

  // ---- get system prompt từ DB ----
  async function getSystemPrompt() {
    try {
      const [rows] = await db.query(
        "SELECT context_text FROM chatbot_context LIMIT 1"
      );
      return (
        rows?.[0]?.context_text ||
        "Bạn là trợ lý AI thân thiện, trả lời ngắn gọn, hữu ích cho khách truy cập website."
      );
    } catch {
      return "Bạn là trợ lý AI thân thiện, trả lời ngắn gọn, hữu ích cho khách truy cập website.";
    }
  }

  // Helper: cắt bớt lịch sử
  function trimHistory(history) {
    if (!Array.isArray(history)) return [];
    // giữ tối đa MAX_TURNS*2 message (user+model)
    const maxMsgs = MAX_TURNS * 2;
    return history.length > maxMsgs ? history.slice(-maxMsgs) : history;
  }

  // Helper: build contents từ history + tin nhắn mới
  function buildContents(history, userText) {
    const base = Array.isArray(history) ? history : [];
    return [...base, { role: "user", parts: [{ text: userText }] }];
  }

  // Sử dụng namespace riêng cho Gemini
  const geminiNamespace = io.of("/gemini");

  geminiNamespace.on("connection", async (socket) => {
    // Tải sẵn system prompt cho phiên này
    socket.data.systemPrompt = await getSystemPrompt();
    // Khởi tạo lịch sử hội thoại
    socket.data.history = [];

    // ===== TEXT: Google Search + Context + Streaming =====
    socket.on("user_message", async (data) => {
      const userText = (data && (data.message || data)) || "Xin chào!";

      try {
        // Build contents có context lịch sử
        const contents = buildContents(socket.data.history, userText);

        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
          systemInstruction: socket.data.systemPrompt, // Context từ DB
          tools, // Google Search
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 1024,
          },
        });

        const result = await model.generateContentStream({
          contents,
        });

        let fullText = "";
        let lastGrounding = null;

        // Kiểm tra xem result có stream không và xử lý đúng cách
        if (result && result.stream) {
          try {
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                fullText += chunkText;
                socket.emit("bot_response_chunk", { chunk: chunkText });
              }
            }
          } catch (streamError) {
            // Nếu stream fail, thử dùng response thường
            const response = await result.response;
            fullText = response.text();
          }
        } else {
          // Fallback: sử dụng generateContent thường nếu stream không khả dụng
          const response = await model.generateContent({
            contents,
          });
          fullText = response.response.text();
        }

        const finalText = fullText.trim();

        // Cập nhật lịch sử (giữ ngắn)
        socket.data.history.push({ role: "user", parts: [{ text: userText }] });
        socket.data.history.push({
          role: "model",
          parts: [{ text: finalText }],
        });
        socket.data.history = trimHistory(socket.data.history);

        socket.emit("bot_response", {
          response: finalText,
          // đưa grounding metadata để client render citation/search widget
          groundingMetadata: lastGrounding || null,
        });
      } catch (e) {
        socket.emit("error_response", {
          error:
            "Lỗi khi xử lý tin nhắn (Gemini 2.5 Pro): " +
            (e?.message || "Không rõ nguyên nhân"),
        });
      }
    });

    // ===== VISION: 1.5 Flash (giữ nguyên logic của bạn) =====
    socket.on("user_image", async (payload = {}) => {
      try {
        // Sử dụng Gemini 1.5 Flash cho vision analysis (tốt hơn 2.5 Pro cho image)
        const visionModel = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
        });

        const data = payload.data || payload.image;
        const prompt = payload.prompt || payload.message || "";

        if (data && data.startsWith("data:")) {
          const commaIndex = data.indexOf(",");
          if (commaIndex !== -1) {
            const base64 = data.substring(commaIndex + 1);
            const bytes = Math.floor((base64.length * 3) / 4);
            const mb = bytes / (1024 * 1024);
            if (mb > MAX_IMAGE_MB) {
              socket.emit("error_response", {
                error: `Ảnh quá lớn (~${mb.toFixed(
                  2
                )}MB). Vui lòng nén < ${MAX_IMAGE_MB}MB.`,
              });
              return;
            }
          }
        }

        const parts = [];
        if (prompt && prompt.trim()) {
          parts.push({ text: prompt.trim() });
        } else {
          parts.push({
            text: "Hãy phân tích bản vẽ thiết kế này và gợi ý 2 sản phẩm nội thất phù hợp nhất cho không gian. Vui lòng chỉ gợi ý tên sản phẩm cụ thể (ví dụ: 'sofa', 'bàn coffee', 'tủ kệ TV', v.v.)",
          });
        }

        if (data && data.startsWith("data:")) {
          const commaIndex = data.indexOf(",");
          if (commaIndex === -1) {
            socket.emit("error_response", {
              error: "Định dạng ảnh không hợp lệ - thiếu dấu phẩy.",
            });
            return;
          }
          const meta = data.substring(0, commaIndex);
          const base64 = data.substring(commaIndex + 1);
          const mimeType = meta.split(";")[0].replace("data:", "");
          if (!base64 || base64.length === 0) {
            socket.emit("error_response", {
              error: "Dữ liệu base64 trống hoặc không hợp lệ.",
            });
            return;
          }
          parts.push({
            inlineData: { mimeType, data: base64 },
          });
        } else {
          socket.emit("error_response", {
            error:
              "Không tìm thấy dữ liệu ảnh hợp lệ. Vui lòng gửi ảnh dạng base64.",
          });
          return;
        }

        const result = await visionModel.generateContent(parts);

        const reply = result.response.text();
        socket.emit("bot_response", { response: reply });
        
      } catch (error) {
        socket.emit("error_response", {
          error: "Lỗi khi xử lý hình ảnh (Gemini): " + error.message,
        });
      }
    });

    socket.on("disconnect", () => {
    });
  });
};
