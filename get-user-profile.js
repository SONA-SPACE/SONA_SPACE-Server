const axios = require("axios");

const BASE_URL = "http://localhost:3500";
// Thay thế bằng token của bạn
const USER_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sZSI6InVzZXIiLCJpYXQiOjE3NDk5MzQ5NjgsImV4cCI6MTc1MDAyMTM2OH0.pyrTFtxCmLPC4gpfRFlvTsM8lho7h06F6-hgfDdu2SA";

// Hàm giải mã JWT token
function decodeJWT(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    Buffer.from(base64, "base64")
      .toString()
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );

  return JSON.parse(jsonPayload);
}

// Hiển thị thông tin token
const tokenInfo = decodeJWT(USER_TOKEN);
console.log("Thông tin từ token:");
console.log("- ID người dùng:", tokenInfo.id);
console.log("- Vai trò:", tokenInfo.role);
console.log(
  "- Thời gian tạo:",
  new Date(tokenInfo.iat * 1000).toLocaleString()
);
console.log(
  "- Thời gian hết hạn:",
  new Date(tokenInfo.exp * 1000).toLocaleString()
);

// Hàm lấy thông tin profile
async function getUserProfile() {
  console.log("\nĐang lấy thông tin user profile...");

  try {
    const response = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`,
      },
    });

    console.log("\nThông tin user profile:");
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.log("\nLỗi khi lấy thông tin profile:");
    if (error.response) {
      console.log("- Mã trạng thái:", error.response.status);
      console.log("- Lỗi:", error.response.data);

      // Nếu token hết hạn hoặc không hợp lệ
      if (error.response.status === 401) {
        console.log(
          "\nToken có thể đã hết hạn. Bạn cần đăng nhập lại để lấy token mới."
        );
      }
    } else {
      console.log("- Lỗi:", error.message);
    }
    return null;
  }
}

// Hàm đăng nhập để lấy token mới
async function login() {
  console.log("\nĐang đăng nhập để lấy token mới...");

  try {
    const loginData = {
      email: "user@example.com", // Thay bằng email thực tế của bạn
      password: "password123", // Thay bằng mật khẩu thực tế của bạn
    };

    const response = await axios.post(`${BASE_URL}/api/auth/login`, loginData);

    console.log("\nĐăng nhập thành công!");
    console.log("Token mới:", response.data.token);

    // Giải mã token mới
    const newTokenInfo = decodeJWT(response.data.token);
    console.log("\nThông tin token mới:");
    console.log("- ID người dùng:", newTokenInfo.id);
    console.log("- Vai trò:", newTokenInfo.role);
    console.log(
      "- Thời gian tạo:",
      new Date(newTokenInfo.iat * 1000).toLocaleString()
    );
    console.log(
      "- Thời gian hết hạn:",
      new Date(newTokenInfo.exp * 1000).toLocaleString()
    );

    return response.data.token;
  } catch (error) {
    console.log("\nLỗi khi đăng nhập:");
    if (error.response) {
      console.log("- Mã trạng thái:", error.response.status);
      console.log("- Lỗi:", error.response.data);
    } else {
      console.log("- Lỗi:", error.message);
    }
    return null;
  }
}

// Thực hiện các bước
async function main() {
  // 1. Thử lấy thông tin profile với token hiện tại
  const profile = await getUserProfile();

  // 2. Nếu không thành công, đăng nhập để lấy token mới
  if (!profile) {
    console.log("\nThử đăng nhập để lấy token mới...");
    const newToken = await login();

    // 3. Nếu đăng nhập thành công, thử lấy profile lại với token mới
    if (newToken) {
      console.log("\nThử lấy profile với token mới...");
      // Lưu token mới vào biến
      const updatedToken = newToken;

      try {
        const response = await axios.get(`${BASE_URL}/api/auth/profile`, {
          headers: {
            Authorization: `Bearer ${updatedToken}`,
          },
        });

        console.log("\nThông tin user profile (với token mới):");
        console.log(JSON.stringify(response.data, null, 2));
      } catch (error) {
        console.log("\nVẫn gặp lỗi khi lấy profile với token mới:");
        if (error.response) {
          console.log("- Mã trạng thái:", error.response.status);
          console.log("- Lỗi:", error.response.data);
        } else {
          console.log("- Lỗi:", error.message);
        }
      }
    }
  }
}

// Chạy chương trình
main();
