// SOCKET.IO cho Gemini 2.5 Pro với Google Search
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const MAX_IMAGE_MB = 5;

module.exports = function attachChatbotSocketGemini25(io) {
  const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Tools cho Gemini 2.5 Pro
  const tools = [
    {
      googleSearch: {}
    },
  ];

  const config = {
    thinkingConfig: {
      thinkingBudget: -1,
    },
    tools,
  };

  // Sử dụng namespace riêng cho Gemini
  const geminiNamespace = io.of('/gemini');

  geminiNamespace.on("connection", (socket) => {
    console.log("Gemini 2.5 Pro socket connected:", socket.id);

    // Text only với Google Search
    socket.on("user_message", async (data) => {
      try {
        console.log("Gemini 2.5 Pro received text:", data);
        const message = data.message || data || "Xin chào!";
        console.log("Processing message with Gemini 2.5 Pro:", message);
        
        const contents = [
          {
            role: 'user',
            parts: [
              {
                text: message,
              },
            ],
          },
        ];

        // Sử dụng streaming response
        const response = await genAI.models.generateContentStream({
          model: 'gemini-2.5-pro',
          config,
          contents,
        });

        let fullResponse = '';
        for await (const chunk of response) {
          if (chunk.text) {
            fullResponse += chunk.text;
            // Gửi từng chunk để real-time response
            socket.emit("bot_response_chunk", { chunk: chunk.text });
          }
        }

        console.log("Gemini 2.5 Pro reply:", fullResponse.substring(0, 100) + "...");
        socket.emit("bot_response", { response: fullResponse });
        
      } catch (error) {
        console.error("Gemini 2.5 Pro user_message error:", error);
        socket.emit("error_response", { error: "Lỗi khi xử lý tin nhắn (Gemini 2.5 Pro): " + error.message });
      }
    });

    // Image analysis (vẫn dùng 1.5 Flash vì 2.5 Pro chưa hỗ trợ vision tốt)
    socket.on("user_image", async (payload = {}) => {
      try {
        console.log("Gemini received image payload for analysis:", {
          hasData: !!payload.data,
          hasImage: !!payload.image,
          hasPrompt: !!payload.prompt,
          hasMessage: !!payload.message,
          dataLength: (payload.data || payload.image) ? (payload.data || payload.image).length : 0
        });

        // Sử dụng Gemini 1.5 Flash cho vision
        const visionAI = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
        });
        const visionModel = visionAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        // Tạo parts cho Gemini vision
        const parts = [];
        
        if (prompt && prompt.trim()) {
          parts.push({ text: prompt.trim() });
        } else {
          parts.push({ text: "Hãy mô tả ảnh này chi tiết, bao gồm các đối tượng, màu sắc, bối cảnh và những điều thú vị bạn nhìn thấy." });
        }

        if (data && data.startsWith("data:")) {
          const commaIndex = data.indexOf(",");
          if (commaIndex === -1) {
            socket.emit("error_response", { error: "Định dạng ảnh không hợp lệ - thiếu dấu phẩy." });
            return;
          }
          
          const meta = data.substring(0, commaIndex);
          const base64 = data.substring(commaIndex + 1);
          const mimeType = meta.split(";")[0].replace("data:", "");
          
          if (!base64 || base64.length === 0) {
            socket.emit("error_response", { error: "Dữ liệu base64 trống hoặc không hợp lệ." });
            return;
          }
          
          console.log("Processing image with Gemini 1.5 Flash:", {
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

        console.log("Sending to Gemini 1.5 Flash for vision analysis, parts count:", parts.length);
        
        const result = await visionModel.generateContent({ 
          contents: [{ role: "user", parts }] 
        });
        
        const reply = result.response.text();
        console.log("Gemini vision analysis reply:", reply.substring(0, 150) + "...");
        socket.emit("bot_response", { response: reply });

      } catch (error) {
        console.error("Gemini vision error:", error);
        socket.emit("error_response", { error: "Lỗi khi xử lý hình ảnh (Gemini): " + error.message });
      }
    });

    // // Test connection
    // socket.on("test_connection", (data) => {
    //   console.log("Gemini 2.5 Pro test connection from:", socket.id, data);
    //   socket.emit("test_response", { 
    //     message: "Kết nối Gemini 2.5 Pro thành công! 🚀 Tôi có Google Search và khả năng phân tích hình ảnh.",
    //     model: "gemini-2.5-pro",
    //     features: ["Google Search", "Thinking Mode", "Real-time Streaming", "Vision Analysis"]
    //   });
    // });

    socket.on("disconnect", () => {
      console.log("Gemini 2.5 Pro socket disconnected:", socket.id);
    });
  });
};
