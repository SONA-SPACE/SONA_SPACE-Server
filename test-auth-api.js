const axios = require('axios');

const BASE_URL = 'http://localhost:3500';

// Thông tin đăng nhập - thay đổi thông tin này theo tài khoản của bạn
const loginData = {
  email: 'nguyenhongthai0802@gmail.com', // Thay bằng email thực tế của bạn
  password: '123456' // Thay bằng mật khẩu thực tế của bạn
};

// Hàm giải mã JWT token
function decodeJWT(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

// 1. Test API login
async function testLogin() {
  console.log('1. Test API login');
  console.log('-----------------');
  
  try {
    console.log(`Đăng nhập với email: ${loginData.email}`);
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, loginData);
    
    console.log('Đăng nhập thành công!');
    console.log('- Mã trạng thái:', response.status);
    console.log('- Message:', response.data.message);
    console.log('- Token:', response.data.token);
    console.log('- Thông tin user:');
    console.log('  + ID:', response.data.user.id);
    console.log('  + Email:', response.data.user.email);
    console.log('  + Họ tên:', response.data.user.full_name);
    console.log('  + Vai trò:', response.data.user.role);
    console.log('  + Số điện thoại:', response.data.user.phone || 'Không có');
    console.log('  + Địa chỉ:', response.data.user.address || 'Không có');
    
    // Giải mã token để kiểm tra
    const tokenInfo = decodeJWT(response.data.token);
    console.log('\nThông tin từ token:');
    console.log('- ID người dùng:', tokenInfo.id);
    console.log('- Vai trò:', tokenInfo.role);
    console.log('- Thời gian tạo:', new Date(tokenInfo.iat * 1000).toLocaleString());
    console.log('- Thời gian hết hạn:', new Date(tokenInfo.exp * 1000).toLocaleString());
    
    return response.data.token;
  } catch (error) {
    console.log('Lỗi khi đăng nhập:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
    } else {
      console.log('- Lỗi:', error.message);
    }
    return null;
  }
}

// 2. Test API profile
async function testProfile(token) {
  console.log('\n2. Test API profile');
  console.log('------------------');
  
  if (!token) {
    console.log('Không có token, không thể test API profile');
    return;
  }
  
  try {
    console.log('Lấy thông tin profile với token');
    
    const response = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Lấy profile thành công!');
    console.log('- Mã trạng thái:', response.status);
    console.log('- Thông tin user:');
    console.log('  + ID:', response.data.user.id);
    console.log('  + Email:', response.data.user.email);
    console.log('  + Họ tên:', response.data.user.full_name);
    console.log('  + Số điện thoại:', response.data.user.phone || 'Không có');
    console.log('  + Địa chỉ:', response.data.user.address || 'Không có');
    console.log('  + Vai trò:', response.data.user.role);
    console.log('  + Ngày tạo:', new Date(response.data.user.created_at).toLocaleString());
    
    return response.data;
  } catch (error) {
    console.log('Lỗi khi lấy profile:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
    } else {
      console.log('- Lỗi:', error.message);
    }
    return null;
  }
}

// Chạy các test
async function runTests() {
  try {
    // 1. Test API login
    const token = await testLogin();
    
    // 2. Test API profile
    if (token) {
      await testProfile(token);
    }
    
    console.log('\nHoàn thành các test!');
  } catch (error) {
    console.log('Lỗi không xác định:', error.message);
  }
}

// Chạy các test
runTests(); 