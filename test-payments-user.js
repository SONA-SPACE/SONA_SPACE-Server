const axios = require('axios');

// Base URL for API
const API_URL = 'http://localhost:3501';

// Token mới của người dùng
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sZSI6InVzZXIiLCJpYXQiOjE3NDgwOTY4OTQsImV4cCI6MTc0ODE4MzI5NH0.hipEvvMWR9Fj_qCIK8Syf_Sb0IbiqJVkQP6OLtjLe1k';

// Giải mã JWT token để xem thông tin
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Lỗi khi giải mã token:', e);
    return null;
  }
}

// Hiển thị thông tin token
const decodedToken = decodeJWT(USER_TOKEN);
console.log('Thông tin token:');
console.log('- ID người dùng:', decodedToken?.id);
console.log('- Vai trò:', decodedToken?.role);
console.log('- Thời gian tạo:', new Date(decodedToken?.iat * 1000).toLocaleString());
console.log('- Thời gian hết hạn:', new Date(decodedToken?.exp * 1000).toLocaleString());
console.log('\n-------------------------------------------');

// Function để test GET /api/payments endpoint
async function testGetPayments() {
  console.log('\n-------------------------------------------');
  console.log('Kiểm tra GET /api/payments endpoint');
  console.log('-------------------------------------------');
  
  try {
    console.log('Gửi yêu cầu đến:', `${API_URL}/api/payments`);
    console.log('Với token:', USER_TOKEN.substring(0, 20) + '...');
    
    const response = await axios.get(`${API_URL}/api/payments`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`
      }
    });
    
    console.log(`Mã trạng thái: ${response.status}`);
    console.log('Headers:', response.headers);
    console.log('Dữ liệu phản hồi (2 mục đầu tiên):');
    
    if (response.data && Array.isArray(response.data.payments)) {
      console.log(`Tổng số thanh toán: ${response.data.payments.length}`);
      const limitedData = response.data.payments.slice(0, 2);
      console.log(JSON.stringify(limitedData, null, 2));
    } else {
      console.log('Định dạng phản hồi không mong đợi:', response.data);
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thanh toán:');
    if (error.response) {
      console.error(`Mã trạng thái: ${error.response.status}`);
      console.error('Dữ liệu phản hồi:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('Không nhận được phản hồi từ server');
    } else {
      console.error('Lỗi khi thiết lập yêu cầu:', error.message);
    }
  }
}

// Function để test GET /api/payments/:id endpoint cho thanh toán của người dùng
async function testGetPaymentById(paymentId = 1) {
  console.log('\n-------------------------------------------');
  console.log(`Kiểm tra GET /api/payments/${paymentId} endpoint`);
  console.log('-------------------------------------------');
  
  try {
    console.log('Gửi yêu cầu đến:', `${API_URL}/api/payments/${paymentId}`);
    console.log('Với token:', USER_TOKEN.substring(0, 20) + '...');
    
    const response = await axios.get(`${API_URL}/api/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`
      }
    });
    
    console.log(`Mã trạng thái: ${response.status}`);
    console.log('Dữ liệu phản hồi:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`Lỗi khi lấy thông tin thanh toán ID ${paymentId}:`);
    if (error.response) {
      console.error(`Mã trạng thái: ${error.response.status}`);
      console.error('Dữ liệu phản hồi:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('Không nhận được phản hồi từ server');
    } else {
      console.error('Lỗi khi thiết lập yêu cầu:', error.message);
    }
  }
}

// Function để test GET /api/payments/order/:orderId endpoint
async function testGetPaymentsByOrderId(orderId = 1) {
  console.log('\n-------------------------------------------');
  console.log(`Kiểm tra GET /api/payments/order/${orderId} endpoint`);
  console.log('-------------------------------------------');
  
  try {
    console.log('Gửi yêu cầu đến:', `${API_URL}/api/payments/order/${orderId}`);
    console.log('Với token:', USER_TOKEN.substring(0, 20) + '...');
    
    const response = await axios.get(`${API_URL}/api/payments/order/${orderId}`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`
      }
    });
    
    console.log(`Mã trạng thái: ${response.status}`);
    console.log('Dữ liệu phản hồi:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`Lỗi khi lấy thanh toán cho đơn hàng ID ${orderId}:`);
    if (error.response) {
      console.error(`Mã trạng thái: ${error.response.status}`);
      console.error('Dữ liệu phản hồi:', error.response.data);
      console.error('Headers:', error.response.headers);
      
      if (error.response.status === 403) {
        console.log('\nLƯU Ý: Lỗi 403 là do không có quyền truy cập đến đơn hàng này.');
        console.log('Đây là hành vi bình thường nếu đơn hàng không thuộc về người dùng hiện tại (ID:', decodedToken?.id, ')');
      }
    } else if (error.request) {
      console.error('Không nhận được phản hồi từ server');
    } else {
      console.error('Lỗi khi thiết lập yêu cầu:', error.message);
    }
  }
}

// Function để lấy danh sách đơn hàng của người dùng hiện tại
async function testGetUserOrders() {
  console.log('\n-------------------------------------------');
  console.log('Kiểm tra GET /api/users/:id/orders endpoint để tìm ID đơn hàng hợp lệ');
  console.log('-------------------------------------------');
  
  try {
    const userId = decodedToken?.id;
    console.log('Gửi yêu cầu đến:', `${API_URL}/api/users/${userId}/orders`);
    console.log('Với token:', USER_TOKEN.substring(0, 20) + '...');
    
    const response = await axios.get(`${API_URL}/api/users/${userId}/orders`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`
      }
    });
    
    console.log(`Mã trạng thái: ${response.status}`);
    console.log('Dữ liệu phản hồi:');
    
    if (response.data && Array.isArray(response.data.orders) && response.data.orders.length > 0) {
      console.log(`Tìm thấy ${response.data.orders.length} đơn hàng của người dùng.`);
      
      // Hiển thị danh sách đơn hàng
      console.log('\nDanh sách đơn hàng:');
      response.data.orders.forEach((order, index) => {
        console.log(`${index+1}. ID: ${order.order_id}, Mã: ${order.order_hash}, Trạng thái: ${order.status_name || 'N/A'}`);
      });
      
      // Chọn đơn hàng đầu tiên để test
      if (response.data.orders.length > 0) {
        const firstOrderId = response.data.orders[0].order_id;
        console.log(`\nSử dụng đơn hàng ID ${firstOrderId} để test API payments/order/:orderId`);
        await testGetPaymentsByOrderId(firstOrderId);
      }
    } else {
      console.log('Không tìm thấy đơn hàng nào của người dùng này.');
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng của người dùng:');
    if (error.response) {
      console.error(`Mã trạng thái: ${error.response.status}`);
      console.error('Dữ liệu phản hồi:', error.response.data);
    } else if (error.request) {
      console.error('Không nhận được phản hồi từ server');
    } else {
      console.error('Lỗi khi thiết lập yêu cầu:', error.message);
    }
  }
}

// Run all tests
async function runTests() {
  console.log('Bắt đầu kiểm tra các endpoints payments...');
  
  // Test GET /api/payments endpoint (có thể sẽ nhận 403 vì yêu cầu quyền admin)
  await testGetPayments();
  
  // Test GET /api/payments/:id endpoint với một số ID thanh toán
  await testGetPaymentById(1);  // Có thể không thuộc về người dùng
  await testGetPaymentById(5);  // Thử ID khác
  
  // Test GET /api/payments/order/:orderId endpoint với orderId = 1
  await testGetPaymentsByOrderId(1);  // Có thể không thuộc về người dùng
  
  // Lấy danh sách đơn hàng của người dùng hiện tại và test với đơn hàng của họ
  await testGetUserOrders();
  
  console.log('\nHoàn thành kiểm tra!');
}

// Execute tests
runTests(); 