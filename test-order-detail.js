const http = require('http');

// Token JWT mới tạo
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6InVzZXIiLCJpYXQiOjE3NDgwOTM0MjMsImV4cCI6MTc1MDY4NTQyM30.6fXqTmo9UbgjhrEHHtsoPpX2VpBrZfuef3Ad6ewZdwI';

// Token Admin để test
const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4MDkzNDIzLCJleHAiOjE3NTA2ODU0MjN9.DtGHeWfN4HjIrj5GnEn2NqqubArN4cq-bMO3sqNy5yg';

// Chọn token muốn sử dụng (user hoặc admin)
const tokenToUse = authToken;

// ID đơn hàng cần kiểm tra
const orderId = 1; // Thay đổi ID này nếu cần

// Cấu hình request
const options = {
  hostname: 'localhost',
  port: 3500,
  path: `/api/orders/${orderId}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${tokenToUse}`,
    'Content-Type': 'application/json'
  }
};

console.log(`Đang gửi request đến ${options.hostname}:${options.port}${options.path}`);

// Gửi request
const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  
  // Nhận dữ liệu
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // Xử lý khi kết thúc nhận dữ liệu
  res.on('end', () => {
    console.log('Response hoàn tất');
    try {
      const parsedData = JSON.parse(data);
      console.log('Dữ liệu đơn hàng:', JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.error('Lỗi khi xử lý JSON:', e.message);
      console.log('Dữ liệu gốc:', data);
    }
  });
});

// Xử lý lỗi kết nối
req.on('error', (error) => {
  console.error('Lỗi kết nối:', error.message);
});

// Kết thúc request
req.end(); 