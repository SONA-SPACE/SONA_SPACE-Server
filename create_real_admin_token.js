const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || 'furnitown-secret-key';

// Tạo token cho admin thực tế (user_id = 5)
const realAdminToken = jwt.sign(
  { 
    id: 5,  // ID của admin thực tế
    role: 'admin'
  }, 
  SECRET_KEY,
  { 
    expiresIn: '30d'
  }
);

console.log('Real Admin Token (user_id = 5):');
console.log(realAdminToken);

// Tạo thêm token cho admin khác
const adminToken2 = jwt.sign(
  { 
    id: 56,  // user_id = 56 (Tô Trọng Nhân)
    role: 'admin'
  }, 
  SECRET_KEY,
  { 
    expiresIn: '30d'
  }
);

console.log('\nAlternative Admin Token (user_id = 56):');
console.log(adminToken2);
