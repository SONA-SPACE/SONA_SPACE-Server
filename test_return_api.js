const axios = require('axios');

async function testReturnStatusUpdate() {
  try {
    console.log('🧪 Testing return status update API...');
    
    // Test case 1: Update to PENDING
    console.log('\n=== TEST 1: Update to PENDING ===');
    const response1 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'PENDING'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_ADMIN_TOKEN' // Bạn cần thêm token admin thực tế
      }
    });
    
    console.log('✅ Response:', response1.data);
    
    // Test case 2: Check current status after update
    console.log('\n=== KIỂM TRA TRẠNG THÁI SAU KHI CẬP NHẬT ===');
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: 'fur.timefortea.io.vn',
      user: 'thainguyen0802',
      password: 'cegatcn!080297',
      database: 'furnitown',
      port: 3306
    });
    
    const [returns] = await connection.query(
      'SELECT status, updated_at FROM order_returns WHERE order_id = 190 ORDER BY updated_at DESC LIMIT 1'
    );
    
    console.log('Trạng thái hiện tại:', returns[0]);
    await connection.end();
    
  } catch (error) {
    console.error('❌ Lỗi:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n⚠️  Lỗi xác thực! Cần token admin để test API.');
      console.log('Hãy kiểm tra middleware auth trong API endpoint.');
    }
  }
}

testReturnStatusUpdate();
