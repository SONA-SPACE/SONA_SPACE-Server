const axios = require('axios');

async function testReturnStatusWithToken() {
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTYsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MzYzMjU5NSwiZXhwIjoxNzU2MjI0NTk1fQ.C9yxC1F2ZTaiPz0RIbcPJ26R3EpaN2xlhaafOvzGUzk';
  
  try {
    console.log('🧪 Testing return status update with admin token...');
    console.log('Token:', adminToken.substring(0, 50) + '...');
    
    // Test case 1: Update to PENDING
    console.log('\n=== TEST 1: Update from REQUESTED to PENDING ===');
    const response1 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'PENDING'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log('✅ Response 1:', response1.data);
    
    // Test case 2: Update to APPROVED
    console.log('\n=== TEST 2: Update from PENDING to APPROVED ===');
    const response2 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'APPROVED'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log('✅ Response 2:', response2.data);
    
    // Test case 3: Update to COMPLETED
    console.log('\n=== TEST 3: Update from APPROVED to COMPLETED ===');
    const response3 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'COMPLETED'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log('✅ Response 3:', response3.data);
    
    // Verify database changes
    console.log('\n=== KIỂM TRA DATABASE SAU KHI CẬP NHẬT ===');
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
    
    const [orders] = await connection.query(
      'SELECT current_status FROM orders WHERE order_id = 190'
    );
    
    console.log('Trạng thái return trong DB:', returns[0]);
    console.log('Trạng thái order trong DB:', orders[0]);
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Lỗi:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Server chưa chạy! Hãy khởi động server trước:');
      console.log('npm start hoặc node app.js');
    }
  }
}

testReturnStatusWithToken();
