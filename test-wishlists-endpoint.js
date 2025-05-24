const http = require('http');

// Thay thế token này bằng token bạn nhận được từ quá trình đăng nhập
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTc0ODA5MDY5MSwiZXhwIjoxNzQ4MTc3MDkxfQ.UqjIc9M46M4eK5nBPbvzxJdDETXhtIno3s1ocR-8I04';

// Endpoint cần kiểm tra
const endpoint = '/api/wishlists';

// Tạo yêu cầu đến endpoint được bảo vệ
const options = {
  hostname: 'localhost',
  port: 3500,
  path: endpoint,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Accept': 'application/json'
  }
};

console.log(`Đang truy cập endpoint được bảo vệ: http://${options.hostname}:${options.port}${options.path}`);
console.log(`Sử dụng token xác thực: ${authToken.substring(0, 20)}...`);

const req = http.request(options, (res) => {
  console.log(`TRẠNG THÁI: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Phản hồi hoàn tất');
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.log('API trả về lỗi:', parsed.error);
      } else {
        console.log('Truy cập thành công!');
        console.log('Xem trước dữ liệu phản hồi:');
        console.log(JSON.stringify(parsed, null, 2).substring(0, 500) + '...');
        console.log(`Số lượng sản phẩm trong wishlist: ${parsed.length}`);
      }
    } catch (e) {
      console.log('Không thể phân tích phản hồi dưới dạng JSON');
      console.log('Phản hồi thô:', data.substring(0, 500) + '...');
    }
  });
});

req.on('error', (e) => {
  console.error(`Kiểm tra kết nối thất bại: ${e.message}`);
});

req.end(); 