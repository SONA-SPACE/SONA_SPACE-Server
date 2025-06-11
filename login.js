const http = require('http');

// Thông tin đăng nhập
const loginData = JSON.stringify({
  email: 'e.hoang@gmail.com',  // Email của admin
  password: '123456'           // Mật khẩu thử nghiệm
});

// Cấu hình request
const options = {
  hostname: 'localhost',
  port: 3501,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

console.log(`Đang gửi request đăng nhập đến: http://${options.hostname}:${options.port}${options.path}`);

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
      
      if (parsedData.token) {
        console.log('\nToken mới:');
        console.log(parsedData.token);
        console.log('\nSử dụng token này trong file test-orders-endpoint.js');
      }
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

// Gửi dữ liệu và kết thúc request
req.write(loginData);
req.end(); 