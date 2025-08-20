// SOCKET.IO cho Gemini 2.5 Pro với Google Search + Context
const { GoogleGenAI } = require("@google/genai");
const db = require("./config/database");
require("dotenv").config();

const MAX_IMAGE_MB = 5;

// Giới hạn lịch sử để tránh prompt nặng
const MAX_TURNS = 12; // mỗi turn = 1 user + 1 model

module.exports = function attachChatbotSocketGemini25(io) {
  const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

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
    console.log("Gemini 2.5 Pro socket connected:", socket.id);

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

        const stream = await genAI.models.generateContentStream({
          model: "gemini-1.5-flash",
          contents,
          // Context cấp hệ thống + tools (Grounding)
          config: {
            systemInstruction: socket.data.systemPrompt, // <<-- CONTEXT TỪ DB
            tools, // <<-- Google Search
            thinkingConfig: { thinkingBudget: -1 }, // reasoning động
            // Bạn có thể tinh chỉnh thêm:
            // temperature: 0.6,
            // topP: 0.9,
            // maxOutputTokens: 1024,
          },
        });

        let fullText = "";
        let lastGrounding = null;

        for await (const chunk of stream) {
          // chunk.text có thể không xuất hiện ở những mẩu metadata đầu
          if (chunk?.text && chunk.text.length) {
            fullText += chunk.text;
            socket.emit("bot_response_chunk", { chunk: chunk.text });
          }
          // nếu SDK trả metadata giữa stream (tuỳ phiên bản), nhớ cập nhật
          if (chunk?.candidates?.[0]?.groundingMetadata) {
            lastGrounding = chunk.candidates[0].groundingMetadata;
          }
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
        console.log("Gemini 2.5 user:", userText);
        console.log("Gemini 2.5 response:", finalText);
      } catch (e) {
        console.error("Gemini 2.5 Pro error:", {
          name: e?.name,
          status: e?.status,
          message: e?.message,
          cause: e?.cause,
        });
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
        console.log("Gemini received image payload for analysis:", {
          hasData: !!payload.data,
          hasImage: !!payload.image,
          hasPrompt: !!payload.prompt,
          hasMessage: !!payload.message,
          dataLength:
            payload.data || payload.image
              ? (payload.data || payload.image).length
              : 0,
        });

        const visionAI = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
        });
        const visionModel = visionAI.getGenerativeModel({
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
            console.log(`Image size: ${mb.toFixed(2)}MB`);
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
            text: "Hãy mô tả ảnh này chi tiết, bao gồm các đối tượng, màu sắc, bối cảnh và những điều thú vị bạn nhìn thấy.",
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

        const result = await visionModel.generateContent({
          contents: [{ role: "user", parts }],
          // bạn cũng có thể gắn systemInstruction ở đây nếu muốn giữ cùng persona
          // systemInstruction: socket.data.systemPrompt,
        });

        const reply = result.response.text();
        socket.emit("bot_response", { response: reply });
      } catch (error) {
        console.error("Gemini vision error:", error);
        socket.emit("error_response", {
          error: "Lỗi khi xử lý hình ảnh (Gemini): " + error.message,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Gemini 2.5 Pro socket disconnected:", socket.id);
    });
  });
};
