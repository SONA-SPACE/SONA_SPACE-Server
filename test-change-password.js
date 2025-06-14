const axios = require('axios');

const BASE_URL = 'http://localhost:3500';

// Thông tin đăng nhập
const email = 'nguyenhongthai0802@gmail.com'; // Thay bằng email thực tế của bạn
const originalPassword = '123456'; // Mật khẩu hiện tại
const newPassword = '654321'; // Mật khẩu mới để test

// Hàm giải mã JWT token
function decodeJWT(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

// 1. Đăng nhập với mật khẩu ban đầu
async function loginWithOriginalPassword() {
  console.log('1. Đăng nhập với mật khẩu ban đầu');
  console.log('----------------------------------');
  
  try {
    console.log(`Đăng nhập với email: ${email} và mật khẩu: ${originalPassword}`);
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email,
      password: originalPassword
    });
    
    console.log('Đăng nhập thành công!');
    console.log('- Mã trạng thái:', response.status);
    console.log('- Token:', response.data.token);
    console.log('- User ID:', response.data.user.id);
    
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

// 2. Đổi mật khẩu
async function changePassword(token, currentPassword, newPassword) {
  console.log('\n2. Đổi mật khẩu');
  console.log('----------------');
  
  try {
    console.log(`Đổi mật khẩu từ "${currentPassword}" thành "${newPassword}"`);
    
    const response = await axios.post(`${BASE_URL}/api/auth/change-password`, {
      currentPassword,
      newPassword
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Đổi mật khẩu thành công!');
    console.log('- Mã trạng thái:', response.status);
    console.log('- Message:', response.data.message);
    console.log('- User ID:', response.data.user_id);
    
    return true;
  } catch (error) {
    console.log('Lỗi khi đổi mật khẩu:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
    } else {
      console.log('- Lỗi:', error.message);
    }
    return false;
  }
}

// 3. Đăng nhập với mật khẩu mới
async function loginWithNewPassword() {
  console.log('\n3. Đăng nhập với mật khẩu mới');
  console.log('------------------------------');
  
  try {
    console.log(`Đăng nhập với email: ${email} và mật khẩu mới: ${newPassword}`);
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email,
      password: newPassword
    });
    
    console.log('Đăng nhập thành công với mật khẩu mới!');
    console.log('- Mã trạng thái:', response.status);
    console.log('- Token:', response.data.token);
    
    return response.data.token;
  } catch (error) {
    console.log('Lỗi khi đăng nhập với mật khẩu mới:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
    } else {
      console.log('- Lỗi:', error.message);
    }
    return null;
  }
}

// 4. Khôi phục mật khẩu ban đầu
async function restoreOriginalPassword(token) {
  console.log('\n4. Khôi phục mật khẩu ban đầu');
  console.log('------------------------------');
  
  try {
    console.log(`Đổi mật khẩu từ "${newPassword}" về "${originalPassword}"`);
    
    const response = await axios.post(`${BASE_URL}/api/auth/change-password`, {
      currentPassword: newPassword,
      newPassword: originalPassword
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Khôi phục mật khẩu thành công!');
    console.log('- Mã trạng thái:', response.status);
    console.log('- Message:', response.data.message);
    
    return true;
  } catch (error) {
    console.log('Lỗi khi khôi phục mật khẩu:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
    } else {
      console.log('- Lỗi:', error.message);
    }
    return false;
  }
}

// 5. Xác nhận mật khẩu đã được khôi phục
async function confirmOriginalPassword() {
  console.log('\n5. Xác nhận mật khẩu đã được khôi phục');
  console.log('-------------------------------------');
  
  try {
    console.log(`Đăng nhập lại với email: ${email} và mật khẩu ban đầu: ${originalPassword}`);
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email,
      password: originalPassword
    });
    
    console.log('Đăng nhập thành công với mật khẩu ban đầu!');
    console.log('- Mã trạng thái:', response.status);
    console.log('- Message:', response.data.message);
    
    return true;
  } catch (error) {
    console.log('Lỗi khi đăng nhập với mật khẩu ban đầu:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
    } else {
      console.log('- Lỗi:', error.message);
    }
    return false;
  }
}

// Chạy toàn bộ quy trình test
async function runTest() {
  try {
    console.log('=== BẮT ĐẦU TEST API ĐỔI MẬT KHẨU ===\n');
    
    // 1. Đăng nhập với mật khẩu ban đầu
    const originalToken = await loginWithOriginalPassword();
    if (!originalToken) {
      console.log('\nTest thất bại: Không thể đăng nhập với mật khẩu ban đầu');
      return;
    }
    
    // 2. Đổi mật khẩu
    const changeSuccess = await changePassword(originalToken, originalPassword, newPassword);
    if (!changeSuccess) {
      console.log('\nTest thất bại: Không thể đổi mật khẩu');
      return;
    }
    
    // 3. Đăng nhập với mật khẩu mới
    const newToken = await loginWithNewPassword();
    if (!newToken) {
      console.log('\nTest thất bại: Không thể đăng nhập với mật khẩu mới');
      return;
    }
    
    // 4. Khôi phục mật khẩu ban đầu
    const restoreSuccess = await restoreOriginalPassword(newToken);
    if (!restoreSuccess) {
      console.log('\nTest thất bại: Không thể khôi phục mật khẩu ban đầu');
      console.log('CẢNH BÁO: Mật khẩu đã bị thay đổi thành', newPassword);
      return;
    }
    
    // 5. Xác nhận mật khẩu đã được khôi phục
    const confirmSuccess = await confirmOriginalPassword();
    if (!confirmSuccess) {
      console.log('\nTest thất bại: Không thể xác nhận mật khẩu đã được khôi phục');
      return;
    }
    
    console.log('\n=== KẾT THÚC TEST API ĐỔI MẬT KHẨU ===');
    console.log('Kết quả: THÀNH CÔNG');
    console.log('Tất cả các bước test đã hoàn thành thành công!');
  } catch (error) {
    console.log('\n=== KẾT THÚC TEST API ĐỔI MẬT KHẨU ===');
    console.log('Kết quả: THẤT BẠI');
    console.log('Lỗi không xác định:', error.message);
  }
}

// Chạy test
runTest(); 