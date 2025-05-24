const http = require('http');

// Token Admin để test (cần quyền admin để xem tất cả đơn hàng)
const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4MDkzNDIzLCJleHAiOjE3NTA2ODU0MjN9.DtGHeWfN4HjIrj5GnEn2NqqubArN4cq-bMO3sqNy5yg';

// Cấu hình request
const options = {
  hostname: 'localhost',
  port: 3500,
  path: '/api/orders?page=1&limit=5',
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
      
      // In tổng số đơn hàng và số trang
      console.log(`Tổng số đơn hàng: ${parsedData.total}`);
      console.log(`Số trang: ${parsedData.total_pages}`);
      console.log(`Trang hiện tại: ${parsedData.current_page}`);
      
      // In danh sách đơn hàng (chỉ hiển thị một số trường quan trọng)
      console.log('Danh sách đơn hàng:');
      parsedData.orders.forEach((order, index) => {
        console.log(`\n--- Đơn hàng ${index + 1} ---`);
        console.log(`ID: ${order.order_id}`);
        console.log(`Mã đơn: ${order.order_hash}`);
        console.log(`Khách hàng: ${order.user_name} (${order.user_email})`);
        console.log(`Trạng thái: ${order.status_name}`);
        console.log(`Tổng tiền: ${order.order_total_final}`);
        console.log(`Ngày tạo: ${order.created_at}`);
      });
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