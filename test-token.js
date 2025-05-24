const jwt = require('jsonwebtoken');

// Token từ endpoint đăng nhập
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTc0ODA5MjE5OCwiZXhwIjoxNzQ4MTc4NTk4fQ.1jOxXuaRbb5L61j2KAL2dvUDSrgw3M5TTXU-Qh2U5pg';

try {
  // Giải mã token
  const decoded = jwt.decode(token);
  console.log('Thông tin token:');
  console.log(decoded);
  
  // Kiểm tra xem token có chứa userId hay id
  if (decoded.userId) {
    console.log('\nToken chứa userId:', decoded.userId);
  } else if (decoded.id) {
    console.log('\nToken chứa id:', decoded.id);
  } else {
    console.log('\nToken không chứa cả userId và id');
  }
  
  // Hiển thị thời gian hết hạn
  if (decoded.exp) {
    const expiryDate = new Date(decoded.exp * 1000);
    console.log('\nToken hết hạn vào:', expiryDate.toLocaleString());
  }
} catch (error) {
  console.error('Lỗi khi giải mã token:', error.message);
} 