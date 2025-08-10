const axios = require('axios');

async function testOrderReturnWithoutImages() {
  try {
    console.log('🚀 Testing Order Return API without images first...');
    
    // Test data
    const orderHash = 'SN68822281'; // Thay bằng order hash thật
    const token = 'YOUR_TEST_TOKEN_HERE'; // Thay bằng token thật
    
    const requestData = {
      reason: 'Sản phẩm không đúng như mô tả, yêu cầu hoàn tiền',
      return_type: 'REFUND'
    };
    
    console.log(`📤 Sending return request for order: ${orderHash}`);
    console.log('📋 Request Data:', JSON.stringify(requestData, null, 2));
    
    // Gửi request
    const response = await axios.post(
      `http://localhost:3501/api/orders/return/${orderHash}`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ Response Status:', response.status);
    console.log('📝 Response Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response) {
      console.error('📊 Response Status:', error.response.status);
      console.error('📄 Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Lấy token đăng nhập
async function getTestToken() {
  try {
    console.log('🔐 Getting test token...');
    
    const loginResponse = await axios.post('http://localhost:3501/api/auth/login', {
      user_gmail: 'admin@test.com', // Thay bằng email admin thật
      user_password: 'admin123'      // Thay bằng password thật
    });
    
    if (loginResponse.data.token) {
      console.log('✅ Token obtained:', loginResponse.data.token.substring(0, 20) + '...');
      return loginResponse.data.token;
    }
    
  } catch (error) {
    console.error('❌ Failed to get token:', error.message);
    if (error.response) {
      console.error('📄 Login Error:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Kiểm tra trạng thái đơn hàng trước khi test
async function checkOrderStatus(orderHash, token) {
  try {
    console.log(`🔍 Checking order status for: ${orderHash}`);
    
    const response = await axios.get(
      `http://localhost:3501/api/orders/hash/${orderHash}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data.success) {
      const order = response.data.order;
      console.log('📋 Order Status:', order.status);
      console.log('💰 Order Total:', order.total);
      console.log('👤 Customer:', order.recipientName);
      
      if (order.status !== 'SUCCESS') {
        console.log('⚠️ Warning: Order status is not SUCCESS. Return may fail.');
        console.log('ℹ️ Only orders with SUCCESS status can be returned.');
      }
      
      return order;
    }
    
  } catch (error) {
    console.error('❌ Failed to check order status:', error.message);
    if (error.response) {
      console.error('📄 Error:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Main test function
async function runOrderReturnTest() {
  console.log('🧪 Starting Order Return API Test...\n');
  
  // 1. Lấy token
  const token = await getTestToken();
  if (!token) {
    console.log('❌ Cannot proceed without token');
    return;
  }
  
  // 2. Kiểm tra trạng thái đơn hàng
  const orderHash = 'SN68822281';
  const order = await checkOrderStatus(orderHash, token);
  if (!order) {
    console.log('❌ Cannot proceed without valid order');
    return;
  }
  
  console.log('\n' + '='.repeat(50));
  
  // 3. Test return API
  try {
    const requestData = {
      reason: 'Sản phẩm không đúng như mô tả, bị hỏng trong quá trình vận chuyển. Yêu cầu hoàn tiền.',
      return_type: 'REFUND'
    };
    
    console.log(`📤 Sending return request for order: ${orderHash}`);
    console.log('📋 Request Data:', JSON.stringify(requestData, null, 2));
    
    const response = await axios.post(
      `http://localhost:3501/api/orders/return/${orderHash}`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('\n✅ SUCCESS!');
    console.log('📊 Response Status:', response.status);
    console.log('📝 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 Order return submitted successfully!');
      console.log('🆔 Return ID:', response.data.data.return_id);
      console.log('💰 Total Refund:', response.data.data.total_refund);
      console.log('📦 Items Count:', response.data.data.items.length);
    }
    
  } catch (error) {
    console.log('\n❌ FAILED!');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('📊 Response Status:', error.response.status);
      console.error('📄 Response Data:', JSON.stringify(error.response.data, null, 2));
      
      // Phân tích lỗi
      if (error.response.status === 400) {
        console.log('\n💡 Tip: Check if order status is SUCCESS and reason is provided');
      } else if (error.response.status === 403) {
        console.log('\n💡 Tip: Make sure you have permission to return this order');
      } else if (error.response.status === 404) {
        console.log('\n💡 Tip: Check if order hash exists');
      }
    }
  }
}

// Chạy test
runOrderReturnTest();
