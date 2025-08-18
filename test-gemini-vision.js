// Test Gemini với ảnh thực tế từ attachments
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testGeminiWithRealImage() {
  try {
    console.log("🏠 Testing Gemini với ảnh bản thiết kế nhà...");
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Base64 của ảnh bản thiết kế nhà (rút gọn để test)
    // Đây là một ảnh PNG đơn giản để test - trong thực tế bạn có thể convert ảnh thật
    const floorPlanBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFYSURBVBiVY/j//z8DJQAggJiQOAAIICZkDgACiAmZA4AAYkLmACCAmJA5AAgBJmQOAAKICZkDgABiQuYAIICYkDkACCAmZA4AAogJmQOAAGJC5gAggJiQOQAIICZkDgACiAmZA4AAYkLmACCAmJA5AAgBJmQOAAKICZkDgABiQuYAIICYkDkACCAmZA4AAogJmQOAAGJC5gAggJiQOQAIICZkDgACiAmZA4AAYkLmACCAmJA5AAgBJmQOAAKICZkDgABiQuYAIICYkDkACCAmZA4AAogJmQOAAGJC5gAggJiQOQAIICZkDgACCAmZA4AAYkLmACCAmJA5AAgBJmQOAAKICZkDgABiQuYAIICYkDkACCAmZA4AAogJmQOAAGJC5gAggJiQOQAIICZkDgACiAmZA4AAYkLmACCAmJA5AAggJmQOAAIIGZkDgABiQuYAIICI4AAggJiQOQAIICAAgABDgAX8SL/+oAAAAASUVORK5CYII=";
    
    const prompt = "Hãy phân tích bản thiết kế này và mô tả các phòng, bố cục, và đưa ra nhận xét về thiết kế không gian.";
    
    const parts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/png",
          data: floorPlanBase64
        }
      }
    ];
    
    console.log("📤 Gửi ảnh đến Gemini...");
    const result = await model.generateContent({ 
      contents: [{ role: "user", parts }] 
    });
    
    const reply = result.response.text();
    console.log("🤖 Gemini phân tích thiết kế:");
    console.log("=" * 50);
    console.log(reply);
    console.log("=" * 50);
    
    // Test với ảnh khác - một ảnh màu sắc đơn giản
    console.log("\n🎨 Test với ảnh màu đơn giản...");
    
    // Tạo ảnh 3x3 pixel đỏ
    const redSquareBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAmSURBVAiZY/zPAAQMYABCgAkZw4AJGcOACRnDgAkZw4AJGcOACRkDAB0AAP//VopcAAAAAElFTkSuQmCC";
    
    const colorResult = await model.generateContent({ 
      contents: [{ 
        role: "user", 
        parts: [
          { text: "Ảnh này có màu gì? Hãy mô tả chi tiết màu sắc." },
          {
            inlineData: {
              mimeType: "image/png",
              data: redSquareBase64
            }
          }
        ]
      }] 
    });
    
    console.log("🤖 Gemini phân tích màu sắc:");
    console.log(colorResult.response.text());
    
    console.log("\n✅ Test Gemini Vision hoàn thành!");
    
  } catch (error) {
    console.error("❌ Lỗi test Gemini:", error);
    console.error("Chi tiết lỗi:", error.message);
  }
}

testGeminiWithRealImage();
