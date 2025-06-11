const http = require('http');

// Token xác thực JWT
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTc0ODA5MjE5OCwiZXhwIjoxNzQ4MTc4NTk4fQ.1jOxXuaRbb5L61j2KAL2dvUDSrgw3M5TTXU-Qh2U5pg';

// Danh sách các endpoint cần kiểm tra
const endpoints = [
  { path: '/api/debug/public', needAuth: false, name: 'Endpoint công khai' },
  { path: '/api/debug/protected', needAuth: true, name: 'Endpoint được bảo vệ' },
  { path: '/api/debug/admin', needAuth: true, name: 'Endpoint chỉ dành cho admin' },
  { path: '/api/debug/query-test', needAuth: true, name: 'Kiểm tra truy vấn đơn giản' },
  { path: '/api/debug/join-test', needAuth: true, name: 'Kiểm tra truy vấn JOIN' }
];

// Hàm gửi request
async function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3501,
      path: endpoint.path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Thêm header Authorization nếu cần
    if (endpoint.needAuth) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    console.log(`\n[${endpoint.name}] Đang gửi request đến: http://${options.hostname}:${options.port}${options.path}`);
    
    const req = http.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          console.log('Response data:');
          console.log(JSON.stringify(parsedData, null, 2));
          resolve({ endpoint: endpoint.name, status: res.statusCode, data: parsedData });
        } catch (error) {
          console.error('Error parsing JSON:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Error:', error.message);
      reject(error);
    });
    
    req.end();
  });
}

// Chạy các kiểm tra tuần tự
async function runTests() {
  try {
    for (const endpoint of endpoints) {
      try {
        await testEndpoint(endpoint);
      } catch (error) {
        console.error(`Lỗi khi kiểm tra ${endpoint.name}:`, error.message);
      }
    }
    console.log('\nHoàn tất kiểm tra tất cả các endpoint');
  } catch (error) {
    console.error('Lỗi khi chạy kiểm tra:', error);
  }
}

// Thực thi
runTests(); 