// Test Gemini API với hình ảnh
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testGeminiWithImage() {
  try {
    console.log("🧪 Testing Gemini API with image...");
    
    // Kiểm tra API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not found in .env file");
    }
    
    console.log("✅ Gemini API Key found");
    console.log("🔑 API Key length:", process.env.GEMINI_API_KEY.length);
    
    // Khởi tạo Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    console.log("✅ Gemini model initialized");
    
    // Test 1: Text only
    console.log("\n📝 Test 1: Text only");
    const textResult = await model.generateContent("Xin chào! Bạn có thể giới thiệu về khả năng phân tích hình ảnh của mình không?");
    console.log("🤖 Gemini reply:", textResult.response.text());
    
    // Test 2: Image với base64 (ảnh 1x1 pixel PNG đơn giản)
    console.log("\n🖼️ Test 2: Image analysis with base64");
    
    // Tạo một ảnh test đơn giản (1x1 pixel PNG trong suốt)
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    
    const imagePrompt = "Hãy mô tả ảnh này. Đây là ảnh gì?";
    
    const parts = [
      { text: imagePrompt },
      {
        inlineData: {
          mimeType: "image/png",
          data: testImageBase64
        }
      }
    ];
    
    const imageResult = await model.generateContent({ contents: [{ role: "user", parts }] });
    console.log("🤖 Gemini image analysis:", imageResult.response.text());
    
    console.log("\n✅ All tests completed successfully!");
    
  } catch (error) {
    console.error("❌ Error testing Gemini:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
  }
}

// Chạy test
testGeminiWithImage();
