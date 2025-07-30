const jwt = require('jsonwebtoken');

// Sử dụng cùng JWT_SECRET như trong middleware
const JWT_SECRET = process.env.JWT_SECRET || "troi_oi";

console.log("JWT_SECRET:", JWT_SECRET);

// Tạo token cho user admin (id=53)
const payload = {
  id: 53,
  email: "nguyenhongthai0802@gmail.com", 
  role: "admin"
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '90d' });

console.log("Generated token length:", token.length);
console.log("Generated token (đầy đủ):");
console.log(token);

// Test verify token ngay tại đây
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log("\nToken verify success:", decoded);
} catch (error) {
  console.error("\nToken verify failed:", error.message);
}

// Test API
const testToken = async () => {
  try {
    console.log("\nTesting /api/orders/test-auth...");
    const response = await fetch("http://localhost:3501/api/orders/test-auth", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", data);

    if (response.status === 200) {
      console.log("\nTesting /api/orders/1/send-apology-email...");
      const response2 = await fetch("http://localhost:3501/api/orders/1/send-apology-email", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data2 = await response2.text();
      console.log("Apology email API Status:", response2.status);
      console.log("Apology email API Response:", data2);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
};

testToken();
