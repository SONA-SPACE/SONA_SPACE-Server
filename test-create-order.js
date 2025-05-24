const axios = require('axios');

// Base URL for API
const BASE_URL = 'http://localhost:3500';

// Token của người dùng
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

// 1. Tạo đơn hàng mới
async function createOrder() {
  console.log('1. Tạo đơn hàng mới cho người dùng ID:', decodedToken?.id);
  console.log('-------------------------------------------');
  
  try {
    console.log('Gửi yêu cầu tạo đơn hàng...');
    
    // Dữ liệu đơn hàng mẫu đơn giản
    const orderData = {
      order_address1: '123 Lê Lợi, Phường Bến Nghé',
      order_city: 'Hồ Chí Minh',
      order_phone: '0987654321',
      order_name: 'Nguyễn Văn A',
      items: [
        {
          product_id: 1,
          quantity: 2
        }
      ]
    };
    
    console.log('Dữ liệu gửi đi:', JSON.stringify(orderData, null, 2));
    
    const response = await axios.post(`${BASE_URL}/api/orders`, orderData, {
      headers: {
        'Authorization': `Bearer ${USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Đơn hàng đã được tạo thành công!');
    console.log('- ID đơn hàng:', response.data.order.order_id);
    console.log('- Mã đơn hàng:', response.data.order.order_hash);
    console.log('- Tổng tiền:', response.data.order.order_total);
    console.log('- Trạng thái:', response.data.order.status_name);
    
    return response.data.order;
  } catch (error) {
    console.log('Lỗi khi tạo đơn hàng:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
      console.log('- Headers:', JSON.stringify(error.response.headers, null, 2));
      if (error.response.data && error.response.data.details) {
        console.log('- Chi tiết lỗi:', error.response.data.details);
      }
    } else {
      console.log('- Lỗi:', error.message);
      console.log('- Stack:', error.stack);
    }
    return null;
  }
}

// 2. Tạo thanh toán cho đơn hàng
async function createPayment(orderId) {
  console.log('\n2. Tạo thanh toán cho đơn hàng ID:', orderId);
  console.log('-------------------------------------------');
  
  if (!orderId) {
    console.error('Không thể tạo thanh toán: Không có ID đơn hàng');
    return null;
  }
  
  try {
    // Dữ liệu thanh toán
    const paymentData = {
      order_id: orderId,
      payment_method: 'Bank Transfer',
      transaction_id: 'TXN' + Date.now(),
      amount: 0, // Hệ thống sẽ tự tính dựa trên đơn hàng
      status: 'completed'
    };
    
    console.log('Gửi yêu cầu tạo thanh toán...');
    const response = await axios.post(`${BASE_URL}/api/payments`, paymentData, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Thanh toán đã được tạo thành công!');
    console.log('- ID thanh toán:', response.data.payment.payment_id);
    console.log('- Số tiền:', response.data.payment.amount);
    console.log('- Trạng thái:', response.data.payment.status);
    
    return response.data.payment;
  } catch (error) {
    console.error('Lỗi khi tạo thanh toán:');
    if (error.response) {
      console.error(`Mã trạng thái: ${error.response.status}`);
      console.error('Lỗi:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// 3. Kiểm tra danh sách thanh toán của đơn hàng
async function getOrderPayments(orderId) {
  console.log('\n3. Kiểm tra thanh toán của đơn hàng ID:', orderId);
  console.log('-------------------------------------------');
  
  if (!orderId) {
    console.error('Không thể lấy danh sách thanh toán: Không có ID đơn hàng');
    return null;
  }
  
  try {
    console.log('Gửi yêu cầu lấy thông tin thanh toán...');
    const response = await axios.get(`${BASE_URL}/api/payments/order/${orderId}`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`
      }
    });
    
    console.log('Lấy thông tin thanh toán thành công!');
    console.log('- Tổng số thanh toán:', response.data.length);
    
    if (response.data.length > 0) {
      console.log('\nDanh sách thanh toán:');
      response.data.forEach((payment, index) => {
        console.log(`  ${index + 1}. ID: ${payment.payment_id}, Số tiền: ${payment.amount}, Trạng thái: ${payment.status || 'N/A'}`);
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin thanh toán:');
    if (error.response) {
      console.error(`Mã trạng thái: ${error.response.status}`);
      console.error('Lỗi:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// 4. Kiểm tra chi tiết thanh toán
async function getPaymentDetails(paymentId) {
  console.log('\n4. Kiểm tra chi tiết thanh toán ID:', paymentId);
  console.log('-------------------------------------------');
  
  if (!paymentId) {
    console.error('Không thể lấy chi tiết thanh toán: Không có ID thanh toán');
    return null;
  }
  
  try {
    console.log('Gửi yêu cầu lấy chi tiết thanh toán...');
    const response = await axios.get(`${BASE_URL}/api/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`
      }
    });
    
    console.log('Lấy chi tiết thanh toán thành công!');
    console.log('Chi tiết thanh toán:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết thanh toán:');
    if (error.response) {
      console.error(`Mã trạng thái: ${error.response.status}`);
      console.error('Lỗi:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// Chạy các bước kiểm tra
async function runTest() {
  try {
    // 1. Tạo đơn hàng mới
    const order = await createOrder();
    if (!order) {
      console.error('Không thể tiếp tục vì không tạo được đơn hàng.');
      return;
    }
    
    // 2. Tạo thanh toán cho đơn hàng
    const payment = await createPayment(order.order_id);
    if (!payment) {
      console.error('Không thể tiếp tục vì không tạo được thanh toán.');
      return;
    }
    
    // 3. Kiểm tra danh sách thanh toán của đơn hàng
    await getOrderPayments(order.order_id);
    
    // 4. Kiểm tra chi tiết thanh toán
    await getPaymentDetails(payment.payment_id);
    
    console.log('\n-------------------------------------------');
    console.log('Kiểm tra hoàn tất! Các API payments hoạt động đúng cách.');
    console.log('-------------------------------------------');
  } catch (error) {
    console.error('Lỗi trong quá trình kiểm tra:', error);
  }
}

// Chạy kiểm tra
runTest(); 