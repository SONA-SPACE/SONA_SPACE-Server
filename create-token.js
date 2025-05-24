const jwt = require('jsonwebtoken');
require('dotenv').config();

// Lấy secret key từ biến môi trường hoặc sử dụng giá trị mặc định
const SECRET_KEY = process.env.JWT_SECRET || 'your_jwt_secret';

// Tạo token cho user
const userToken = jwt.sign(
  { 
    id: 1,  // ID của user
    role: 'user' // Vai trò: user hoặc admin
  }, 
  SECRET_KEY,
  { 
    expiresIn: '30d' // Token hết hạn sau 30 ngày
  }
);

console.log('User Token:');
console.log(userToken);

// Tạo token cho admin
const adminToken = jwt.sign(
  { 
    id: 3,  // ID của admin
    role: 'admin' // Vai trò admin
  }, 
  SECRET_KEY,
  { 
    expiresIn: '30d' // Token hết hạn sau 30 ngày
  }
);

console.log('\nAdmin Token:');
console.log(adminToken); 