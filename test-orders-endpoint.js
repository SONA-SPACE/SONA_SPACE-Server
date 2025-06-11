const http = require('http');

// Token xác thực JWT
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTc0ODA5MjE5OCwiZXhwIjoxNzQ4MTc4NTk4fQ.1jOxXuaRbb5L61j2KAL2dvUDSrgw3M5TTXU-Qh2U5pg';

// Cấu hình request
const options = {
  hostname: 'localhost',
  port: 3501,
  path: '/api/orders?page=1&limit=5',  // Giới hạn 5 đơn hàng để dễ xem
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  }
};

console.log(`Đang gửi request đến: http://${options.hostname}:${options.port}${options.path}`);

// Thực hiện request
const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  
  // Nhận dữ liệu response
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // Khi response hoàn tất
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(data);
      console.log('Response data:');
      console.log(JSON.stringify(parsedData, null, 2));
    } catch (error) {
      console.error('Error parsing JSON:', error.message);
      console.log('Raw response:', data);
    }
  });
});

// Xử lý lỗi
req.on('error', (error) => {
  console.error('Error:', error.message);
});

// Kết thúc request
req.end(); 