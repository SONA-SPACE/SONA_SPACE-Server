const http = require('http');

// Token User để test
const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6InVzZXIiLCJpYXQiOjE3NDgwOTM0MjMsImV4cCI6MTc1MDY4NTQyM30.6fXqTmo9UbgjhrEHHtsoPpX2VpBrZfuef3Ad6ewZdwI';

// User ID
const userId = 1;

// Cấu hình request
const options = {
  hostname: 'localhost',
  port: 3501,
  path: `/api/users/${userId}/orders`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${userToken}`,
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
      
      if (Array.isArray(parsedData)) {
        console.log(`Tổng số đơn hàng: ${parsedData.length}`);
        
        // In danh sách đơn hàng (chỉ hiển thị một số trường quan trọng)
        console.log('Danh sách đơn hàng:');
        parsedData.forEach((order, index) => {
          console.log(`\n--- Đơn hàng ${index + 1} ---`);
          console.log(`ID: ${order.order_id}`);
          console.log(`Mã đơn: ${order.order_hash}`);
          console.log(`Trạng thái: ${order.status_name}`);
          console.log(`Tổng tiền: ${order.order_total_final}`);
          console.log(`Ngày tạo: ${order.created_at}`);
        });
      } else {
        console.log('Dữ liệu:', JSON.stringify(parsedData, null, 2));
      }
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