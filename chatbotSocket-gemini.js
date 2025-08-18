const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const MAX_IMAGE_MB = 5;

module.exports = function attachChatbotSocketGemini(io) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Sử dụng namespace riêng cho Gemini
  const geminiNamespace = io.of('/gemini');

  geminiNamespace.on("connection", (socket) => {
    console.log("Gemini socket connected:", socket.id);

    // Text only
    socket.on("user_message", async (data) => {
      try {
        console.log("Gemini received text:", data);
        const message = data.message || data || "Xin chào!";
        console.log("Processing message:", message);
        
        const result = await model.generateContent(message);
        const reply = result.response.text();
        console.log("Gemini reply:", reply.substring(0, 100) + "...");
        socket.emit("bot_response", { response: reply });
      } catch (error) {
        console.error("Gemini user_message error:", error);
        socket.emit("error_response", { error: "Lỗi khi xử lý tin nhắn (Gemini): " + error.message });
      }
    });

    // Image + optional prompt
    socket.on("user_image", async (payload = {}) => {
      try {
        console.log("Gemini received image payload:", {
          hasData: !!payload.data,
          hasImage: !!payload.image,
          hasPrompt: !!payload.prompt,
          hasMessage: !!payload.message,
          dataLength: (payload.data || payload.image) ? (payload.data || payload.image).length : 0
        });

        // Hỗ trợ cả 'data' và 'image' key
        const data = payload.data || payload.image;
        const prompt = payload.prompt || payload.message || "";

        // Kiểm tra size
        if (data && data.startsWith("data:")) {
          const commaIndex = data.indexOf(",");
          if (commaIndex !== -1) {
            const base64 = data.substring(commaIndex + 1);
            const bytes = Math.floor((base64.length * 3) / 4);
            const mb = bytes / (1024 * 1024);
            console.log(`Image size: ${mb.toFixed(2)}MB`);
            
            if (mb > MAX_IMAGE_MB) {
              socket.emit("error_response", { error: `Ảnh quá lớn (~${mb.toFixed(2)}MB). Vui lòng nén < ${MAX_IMAGE_MB}MB.` });
              return;
            }
          }
        }

        // Tạo parts cho Gemini
        const parts = [];
        
        if (prompt && prompt.trim()) {
          parts.push({ text: prompt.trim() });
        } else {
          parts.push({ text: "Hãy mô tả ảnh này chi tiết, bao gồm các đối tượng, màu sắc, bối cảnh và những điều thú vị bạn nhìn thấy." });
        }

        if (data && data.startsWith("data:")) {
          // Tách meta và base64 an toàn hơn
          const commaIndex = data.indexOf(",");
          if (commaIndex === -1) {
            socket.emit("bot_reply", "Định dạng ảnh không hợp lệ - thiếu dấu phẩy.");
            return;
          }
          
          const meta = data.substring(0, commaIndex);
          const base64 = data.substring(commaIndex + 1);
          const mimeType = meta.split(";")[0].replace("data:", "");
          
          // Kiểm tra base64 hợp lệ
          if (!base64 || base64.length === 0) {
            socket.emit("bot_reply", "Dữ liệu base64 trống hoặc không hợp lệ.");
            return;
          }
          
          console.log("Processing image:", {
            mimeType: mimeType,
            base64Length: base64.length,
            base64Sample: base64.substring(0, 50) + "..."
          });
          
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64
            }
          });
          
          console.log("Added image to parts with mime type:", mimeType);
        } else {
          socket.emit("error_response", { error: "Không tìm thấy dữ liệu ảnh hợp lệ. Vui lòng gửi ảnh dạng base64." });
          return;
        }

        console.log("Sending to Gemini with parts count:", parts.length);
        
        const result = await model.generateContent({ 
          contents: [{ role: "user", parts }] 
        });
        
        const reply = result.response.text();
        console.log("Gemini image analysis reply:", reply.substring(0, 150) + "...");
        socket.emit("bot_response", { response: reply });

      } catch (error) {
        console.error("Gemini user_image error:", error);
        socket.emit("error_response", { error: "Lỗi khi xử lý hình ảnh (Gemini): " + error.message });
      }
    });

    // Test connection
    socket.on("test_connection", (data) => {
      console.log("Gemini test connection from:", socket.id, data);
      socket.emit("test_response", { message: "Kết nối Gemini thành công! 🚀 Tôi có thể phân tích cả text và hình ảnh." });
    });

    socket.on("disconnect", () => {
      console.log("Gemini socket disconnected:", socket.id);
    });
  });
};
