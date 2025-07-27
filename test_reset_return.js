const axios = require('axios');

async function testResetReturnStatus() {
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTYsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MzYzMjU5NSwiZXhwIjoxNzU2MjI0NTk1fQ.C9yxC1F2ZTaiPz0RIbcPJ26R3EpaN2xlhaafOvzGUzk';
  
  try {
    console.log('🔄 Testing reset return status...');
    
    // Test reset về REQUESTED
    console.log('\n=== Reset to REQUESTED ===');
    const response = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'REQUESTED'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log('✅ Response:', response.data);
    
    // Verify database changes
    console.log('\n=== KIỂM TRA DATABASE ===');
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
  }
}

testResetReturnStatus();
