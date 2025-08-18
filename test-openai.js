// Simple test to check OpenAI API
require('dotenv').config();
const OpenAI = require("openai").default;

async function testOpenAI() {
  try {
    console.log("Testing OpenAI API...");
    console.log("API Key exists:", !!process.env.OPENAI_API_KEY);
    console.log("API Key length:", process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello in Vietnamese" }
      ],
      max_tokens: 50,
    });

    console.log("✅ OpenAI API working!");
    console.log("Response:", completion.choices[0].message.content);
    
  } catch (error) {
    console.error("❌ OpenAI API error:", error.message);
    if (error.code) {
      console.error("Error code:", error.code);
    }
  }
}

testOpenAI();
