// Sử dụng token từ create-test-token.js (token đầy đủ)
const newToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsImVtYWlsIjoibmd1eWVuaG9uZ3RoYWkwODAyQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNTM3MjY5MCwiZXhwIjoxNzYxNTAyOTA1fQ.-ra73OhhqP-Zzotjobv5c90di9ZUNsMRm6d55pvSf9Y";

console.log("Đang test API gửi email xin lỗi cho đơn hàng ID 1...");

const testApologyEmail = async () => {
  try {
    const response = await fetch("http://localhost:3501/api/orders/1/send-apology-email", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${newToken}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (error) {
    console.error("Error:", error.message);
  }
};

testApologyEmail();
