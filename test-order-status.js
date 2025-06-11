const http = require('http');

// Token Admin để test
const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4MDkzNDIzLCJleHAiOjE3NTA2ODU0MjN9.DtGHeWfN4HjIrj5GnEn2NqqubArN4cq-bMO3sqNy5yg';

// Cấu hình request
const options = {
  hostname: 'localhost',
  port: 3501,
  path: '/api/order-status',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
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
        console.log(`Tổng số trạng thái: ${parsedData.length}`);
        
        // In danh sách trạng thái
        console.log('Danh sách trạng thái đơn hàng:');
        parsedData.forEach((status, index) => {
          console.log(`\n--- Trạng thái ${index + 1} ---`);
          console.log(`ID: ${status.order_status_id}`);
          console.log(`Tên: ${status.order_status_name}`);
          if (status.order_status_color) {
            console.log(`Màu: ${status.order_status_color}`);
          }
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