const jwt = require('jsonwebtoken');
require('dotenv').config();

// Lấy secret key từ biến môi trường hoặc sử dụng giá trị mặc định
const SECRET_KEY = process.env.JWT_SECRET || 'your_jwt_secret';

// Token Admin để test
const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4MDkzNDIzLCJleHAiOjE3NTA2ODU0MjN9.DtGHeWfN4HjIrj5GnEn2NqqubArN4cq-bMO3sqNy5yg';

try {
  // Giải mã token mà không cần xác minh chữ ký
  const decoded = jwt.decode(adminToken);
  console.log('Nội dung token không xác minh:');
  console.log(decoded);
  
  // Giải mã và xác minh token
  try {
    const verified = jwt.verify(adminToken, SECRET_KEY);
    console.log('\nNội dung token đã xác minh:');
    console.log(verified);
  } catch (verifyError) {
    console.error('\nLỗi xác minh token:', verifyError.message);
  }
} catch (error) {
  console.error('Lỗi giải mã token:', error.message);
} 