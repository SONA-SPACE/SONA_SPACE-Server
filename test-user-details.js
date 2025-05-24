const http = require('http');

// Thay thế bằng token JWT hợp lệ của bạn
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTc0ODA5MDY5MSwiZXhwIjoxNzQ4MTc3MDkxfQ.UqjIc9M46M4eK5nBPbvzxJdDETXhtIno3s1ocR-8I04';

// ID của người dùng cần kiểm tra
const userId = 1;

// Mảng các endpoint cần kiểm tra
const endpoints = [
  { path: `/api/users/${userId}`, name: 'Thông tin người dùng' },
  { path: `/api/users/${userId}/orders`, name: 'Đơn hàng của người dùng' },
  { path: `/api/users/${userId}/wishlist`, name: 'Danh sách yêu thích của người dùng' },
  { path: `/api/users/${userId}/reviews`, name: 'Đánh giá của người dùng' }
];

// Hàm để thực hiện một yêu cầu HTTP
function makeRequest(path, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Đang kiểm tra ${name} ===`);
    console.log(`GET http://localhost:3500${path}`);
    
    const options = {
      hostname: 'localhost',
      port: 3500,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      console.log(`Mã trạng thái: ${res.statusCode}`);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          console.log(`Dữ liệu ${name}:`, JSON.stringify(parsedData, null, 2).substring(0, 500) + (JSON.stringify(parsedData, null, 2).length > 500 ? '...' : ''));
          resolve({ status: res.statusCode, data: parsedData });
        } catch (e) {
          console.error(`Lỗi khi phân tích dữ liệu: ${e.message}`);
          console.log('Dữ liệu thô:', data);
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Lỗi kết nối: ${error.message}`);
      reject(error);
    });
    
    req.end();
  });
}

// Thực hiện các yêu cầu tuần tự
async function runTests() {
  try {
    for (const endpoint of endpoints) {
      await makeRequest(endpoint.path, endpoint.name);
    }
    console.log('\n=== Hoàn tất kiểm tra chi tiết người dùng ===');
  } catch (error) {
    console.error('Lỗi khi thực hiện kiểm tra:', error);
  }
}

// Chạy các bài kiểm tra
runTests(); 