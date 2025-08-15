const axios = require('axios');
const jwt = require('jsonwebtoken');

// Tạo token test cho admin
const JWT_SECRET = process.env.JWT_SECRET || "troi_oi";

const adminPayload = {
  id: 53,
  email: "nguyenhongthai0802@gmail.com", 
  role: "admin"
};

const userPayload = {
  id: 1,
  email: "a.nguyen@gmail.com", 
  role: "user"
};

const adminToken = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '90d' });
const userToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '90d' });

async function testCancelOrder() {
  console.log('🧪 Testing order cancellation...\n');
  
  const API_BASE = 'http://localhost:3501';
  
  try {
    // Test 1: Kiểm tra order tồn tại trước
    console.log('📋 Step 1: Checking available orders...');
    const ordersResponse = await axios.get(`${API_BASE}/api/orders-id/1`);
    console.log('Orders for user 1:', ordersResponse.data.orders.length);
    
    if (ordersResponse.data.orders.length > 0) {
      const testOrder = ordersResponse.data.orders[0];
      console.log(`Found test order: ${testOrder.id} (${testOrder.order_hash}) - Status: ${testOrder.status}`);
      
      // Test 2: User tự hủy đơn hàng của mình
      console.log('\n🔒 Step 2: Testing user cancellation...');
      try {
        const userCancelResponse = await axios.put(
          `${API_BASE}/api/orders-id/cancel/${testOrder.id}`,
          {
            reason: 'Tôi muốn hủy đơn hàng này'
          },
          {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ User cancel success:', userCancelResponse.data);
      } catch (userError) {
        console.log('❌ User cancel error:', userError.response?.data || userError.message);
      }
      
      // Test 3: Admin hủy đơn hàng
      console.log('\n👑 Step 3: Testing admin cancellation...');
      try {
        const adminCancelResponse = await axios.put(
          `${API_BASE}/api/orders-id/cancel/${testOrder.id}`,
          {
            reason: 'Admin hủy đơn hàng do sự cố kỹ thuật'
          },
          {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Admin cancel success:', adminCancelResponse.data);
      } catch (adminError) {
        console.log('❌ Admin cancel error:', adminError.response?.data || adminError.message);
      }
    } else {
      console.log('❌ No orders found for testing');
    }
    
    // Test 4: Test với order ID không tồn tại
    console.log('\n🚫 Step 4: Testing invalid order ID...');
    try {
      const invalidResponse = await axios.put(
        `${API_BASE}/api/orders-id/cancel/99999`,
        {
          reason: 'Test invalid order'
        },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Unexpected success:', invalidResponse.data);
    } catch (invalidError) {
      console.log('Expected error for invalid order:', invalidError.response?.data?.message);
    }
    
    // Test 5: Test without token
    console.log('\n🔓 Step 5: Testing without authentication...');
    try {
      const noAuthResponse = await axios.put(
        `${API_BASE}/api/orders-id/cancel/1`,
        {
          reason: 'Test without auth'
        }
      );
      
      console.log('Unexpected success:', noAuthResponse.data);
    } catch (noAuthError) {
      console.log('Expected auth error:', noAuthError.response?.data?.message || noAuthError.response?.status);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️ Server not running on port 3501');
      console.log('💡 Please start the server first: npm start');
    } else {
      console.log('❌ Test failed:', error.message);
    }
  }
}

// Chạy test
testCancelOrder();
