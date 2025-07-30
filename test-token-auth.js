const axios = require('axios');

async function testTokenAuth() {
  try {
    // Sử dụng token admin
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUzNzI2MzMwLCJleHAiOjE3NTYzMTgzMzB9.tOJka6hJefU9IwTSftrUFWwGmDNMM5PMC4XXAuwjgHj4';

    // Test API lấy danh sách đơn hàng admin trước
    console.log('🔍 Đang test API danh sách đơn hàng admin...');
    
    const ordersResponse = await axios.get(
      'http://localhost:3501/api/orders/admin', 
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ API admin orders hoạt động:', ordersResponse.data.orders?.length || 0, 'đơn hàng');
    
    if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
      const firstOrderId = ordersResponse.data.orders[0].order_id;
      console.log(`\n📧 Thử gửi email cho đơn hàng ID ${firstOrderId}...`);
      
      const emailResponse = await axios.post(
        `http://localhost:3501/api/orders/${firstOrderId}/send-apology-email`, 
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Email API Response:', emailResponse.data);
    } else {
      console.log('❌ Không có đơn hàng nào để test');
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

testTokenAuth();
