const axios = require('axios');
const jwt = require('jsonwebtoken');

// Tạo token test
const JWT_SECRET = process.env.JWT_SECRET || "troi_oi";

const userPayload = {
  id: 56, // User có nhiều orders PENDING
  email: "user56@example.com", 
  role: "user"
};

const adminPayload = {
  id: 53,
  email: "nguyenhongthai0802@gmail.com", 
  role: "admin"
};

const userToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '90d' });
const adminToken = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '90d' });

async function testCancelOrderFixed() {
  console.log('🧪 Testing fixed order cancellation...\n');
  
  const API_BASE = 'http://localhost:3501';
  
  try {
    // Test với order PENDING của user 56
    const testOrderId = 428; // Order PENDING từ check trước
    
    console.log(`📋 Testing with order ${testOrderId} (PENDING status)...`);
    
    // Test 1: User tự hủy đơn hàng PENDING
    console.log('\n🔒 Step 1: User canceling PENDING order...');
    try {
      const userCancelResponse = await axios.put(
        `${API_BASE}/api/orders-id/cancel/${testOrderId}`,
        {
          reason: 'Tôi không cần nữa'
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
      
      // Nếu user không cancel được, thử admin
      console.log('\n👑 Step 2: Admin force canceling...');
      try {
        const adminCancelResponse = await axios.put(
          `${API_BASE}/api/orders-id/cancel/${testOrderId}`,
          {
            reason: 'Admin hủy giúp khách hàng'
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
    }
    
    // Test 3: Thử với order khác
    console.log('\n🔄 Step 3: Testing with another order...');
    const anotherOrderId = 427;
    
    try {
      const response = await axios.put(
        `${API_BASE}/api/orders-id/cancel/${anotherOrderId}`,
        {
          reason: 'Test order khác'
        },
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Another order cancel success:', response.data);
    } catch (error) {
      console.log('❌ Another order cancel error:', error.response?.data || error.message);
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
testCancelOrderFixed();
