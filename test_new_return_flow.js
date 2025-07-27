const axios = require('axios');

async function testNewReturnFlow() {
  const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTYsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MzYzMjU5NSwiZXhwIjoxNzU2MjI0NTk1fQ.C9yxC1F2ZTaiPz0RIbcPJ26R3EpaN2xlhaafOvzGUzk';
  
  try {
    console.log('🧪 Testing NEW return flow for order 190...');
    
    // Bước 1: Khởi tạo với PENDING (thay vì REQUESTED)
    console.log('\n=== BƯỚC 1: Khởi tạo PENDING ===');
    const step1 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'PENDING'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log('✅ Response:', step1.data);
    
    // Bước 2: Chuyển sang APPROVED
    console.log('\n=== BƯỚC 2: Chuyển sang APPROVED ===');
    const step2 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'APPROVED'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log('✅ Response:', step2.data);
    
    // Bước 3: Chuyển sang CANCEL_CONFIRMED
    console.log('\n=== BƯỚC 3: Chuyển sang CANCEL_CONFIRMED ===');
    const step3 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'CANCEL_CONFIRMED'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log('✅ Response:', step3.data);
    
    // Bước 4: Hoàn tất với CANCELLED
    console.log('\n=== BƯỚC 4: Hoàn tất với CANCELLED ===');
    const step4 = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'CANCELLED'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log('✅ Response:', step4.data);
    
    // Test nhánh REJECTED
    console.log('\n=== TEST REJECTED: Reset về PENDING rồi REJECTED ===');
    await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'PENDING'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const stepReject = await axios.put('http://localhost:3501/api/orders/190/return-status', {
      return_status: 'REJECTED'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log('✅ REJECTED Response:', stepReject.data);
    
    // Verify database
    console.log('\n=== KIỂM TRA DATABASE CUỐI CÙNG ===');
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

testNewReturnFlow();
