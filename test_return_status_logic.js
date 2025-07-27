const fetch = require('node-fetch');

// Cấu hình test
const API_BASE = 'http://localhost:3501';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUzNjQ2ODU4LCJleHAiOjE3NTYyMzg4NTh9.h3ii0Z4HC6aBdFrONCUb_oN4CLmz4Q51Nvj1VQX1TBQ';

// Headers cho API request
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ADMIN_TOKEN}`
};

async function testReturnStatusLogic() {
  console.log('🧪 Testing Return Status Logic');
  console.log('='.repeat(50));
  
  try {
    // Bước 1: Lấy danh sách đơn hàng để tìm một đơn hàng test
    console.log('\n1️⃣ Fetching orders...');
    const ordersResponse = await fetch(`${API_BASE}/api/orders/admin`, { headers });
    const ordersData = await ordersResponse.json();
    
    if (!ordersData.success || !ordersData.orders.length) {
      throw new Error('No orders found');
    }
    
    const testOrder = ordersData.orders[0];
    console.log(`✅ Found test order: ${testOrder.order_hash} (ID: ${testOrder.order_id})`);
    console.log(`   Current status: ${testOrder.current_status}`);
    
    // Bước 2: Test thay đổi return status khi current_status KHÔNG phải là RETURN
    if (testOrder.current_status !== 'RETURN') {
      console.log('\n2️⃣ Testing return status change when current_status is NOT RETURN...');
      
      const returnStatusResponse = await fetch(`${API_BASE}/api/orders/${testOrder.order_id}/return-status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ return_status: 'PENDING' })
      });
      
      const returnStatusData = await returnStatusResponse.json();
      console.log(`📋 Response:`, returnStatusData);
      
      if (!returnStatusData.success) {
        console.log('✅ PASSED: Correctly rejected return status change when current_status is not RETURN');
      } else {
        console.log('❌ FAILED: Should not allow return status change when current_status is not RETURN');
      }
    }
    
    // Bước 3: Thay đổi current_status thành RETURN để test
    console.log('\n3️⃣ Changing order status to RETURN for testing...');
    const statusResponse = await fetch(`${API_BASE}/api/orders/${testOrder.order_id}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ new_status: 'RETURN' })
    });
    
    const statusData = await statusResponse.json();
    console.log(`📋 Status change response:`, statusData);
    
    if (statusData.success) {
      console.log('✅ Successfully changed order status to RETURN');
      
      // Bước 4: Test thay đổi return status khi current_status là RETURN
      console.log('\n4️⃣ Testing return status changes when current_status is RETURN...');
      
      const testStatuses = ['PENDING', 'APPROVED', 'CANCEL_CONFIRMED', 'CANCELLED', 'REJECTED'];
      
      for (const status of testStatuses) {
        console.log(`\n   Testing status: ${status}`);
        
        const returnResponse = await fetch(`${API_BASE}/api/orders/${testOrder.order_id}/return-status`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ return_status: status })
        });
        
        const returnData = await returnResponse.json();
        console.log(`   📋 Response:`, returnData);
        
        if (returnData.success) {
          console.log(`   ✅ Successfully updated return status to: ${status}`);
        } else {
          console.log(`   ❌ Failed to update return status to: ${status}`);
        }
        
        // Ngủ 1 giây giữa các requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Bước 5: Test reset return status (về "")
      console.log('\n5️⃣ Testing reset return status to empty...');
      const resetResponse = await fetch(`${API_BASE}/api/orders/${testOrder.order_id}/return-status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ return_status: '' })
      });
      
      const resetData = await resetResponse.json();
      console.log(`📋 Reset response:`, resetData);
      
      if (resetData.success) {
        console.log('✅ Successfully reset return status and order should be back to SUCCESS');
      } else {
        console.log('❌ Failed to reset return status');
      }
    }
    
    // Bước 6: Kiểm tra trạng thái cuối cùng
    console.log('\n6️⃣ Checking final order status...');
    const finalResponse = await fetch(`${API_BASE}/api/orders/admin`, { headers });
    const finalData = await finalResponse.json();
    
    const finalOrder = finalData.orders.find(o => o.order_id === testOrder.order_id);
    if (finalOrder) {
      console.log(`✅ Final order status: ${finalOrder.current_status}`);
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Chạy test
testReturnStatusLogic();
