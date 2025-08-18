// Test script để kiểm tra chatbot với hình ảnh
const io = require("socket.io-client");

// Kết nối đến server với options chi tiết
const socket = io("http://localhost:3501", {
  transports: ['websocket', 'polling'],
  timeout: 5000,
  forceNew: true
});

console.log("🔗 Attempting to connect...");

socket.on("connect", () => {
  console.log("✅ Connected to chatbot server with ID:", socket.id);
  
  // Test connection
  console.log("📡 Testing connection...");
  socket.emit("test_connection");
  
  // Test text message first
  setTimeout(() => {
    console.log("📝 Sending text message...");
    socket.emit("user_message", "Hello, this is a test message");
  }, 1000);
  
  // Test image after text
  setTimeout(() => {
    const testImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    console.log("🖼️ Sending test image...");
    socket.emit("user_image", {
      data: testImageBase64,
      prompt: "Đây là ảnh gì?"
    });
  }, 3000);
});

socket.on("connection_ok", (message) => {
  console.log("✅ Connection test response:", message);
});

socket.on("bot_reply", (reply) => {
  console.log("🤖 Bot reply:", reply);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected from server, reason:", reason);
});

socket.on("connect_error", (error) => {
  console.error("❌ Connection error:", error.message);
  console.error("Error details:", error);
});

socket.on("error", (error) => {
  console.error("❌ Socket error:", error);
});

// Tự động thoát sau 15 giây
setTimeout(() => {
  console.log("⏰ Test completed, closing connection");
  socket.disconnect();
  process.exit(0);
}, 15000);
