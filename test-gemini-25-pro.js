// Test Gemini 2.5 Pro với Google Search
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function testGemini25Pro() {
  try {
    console.log('🧪 Testing Gemini 2.5 Pro with Google Search...');
    
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    
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
    
    const model = 'gemini-2.5-pro';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: 'Tìm hiểu về xu hướng thiết kế nội thất năm 2025 và so sánh với SONA SPACE',
          },
        ],
      },
    ];

    console.log('📤 Sending request to Gemini 2.5 Pro...');
    
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });
    
    console.log('📨 Receiving response from Gemini 2.5 Pro:');
    console.log('=' .repeat(50));
    
    for await (const chunk of response) {
      if (chunk.text) {
        process.stdout.write(chunk.text);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Gemini 2.5 Pro:', error);
    console.error('Chi tiết lỗi:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Chạy test
testGemini25Pro();
