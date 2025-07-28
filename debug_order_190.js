const mysql = require('mysql2/promise');

async function debugOrder190() {
  let connection;
  try {
    // Kết nối database
    connection = await mysql.createConnection({
      host: 'fur.timefortea.io.vn',
      user: 'thainguyen0802',
      password: 'cegatcn!080297',
      database: 'furnitown',
      port: 3306
    });
    
    console.log('✅ Kết nối database thành công');
    
    // Kiểm tra đơn hàng 190
    console.log('\n=== THÔNG TIN ĐƠN HÀNG 190 ===');
    const [orders] = await connection.query(
      'SELECT order_id, order_hash, current_status, created_at FROM orders WHERE order_id = 190'
    );
    console.log('Đơn hàng:', orders[0] || 'Không tìm thấy');
    
    // Kiểm tra bảng order_returns
    console.log('\n=== THÔNG TIN HOÀN TRẢ ===');
    const [returns] = await connection.query(
      'SELECT return_id, order_id, user_id, reason, return_type, total_refund, status, created_at, updated_at FROM order_returns WHERE order_id = 190 ORDER BY created_at DESC'
    );
    
    if (returns.length > 0) {
      console.log('Có', returns.length, 'bản ghi hoàn trả:');
      returns.forEach((ret, index) => {
        console.log(`${index + 1}.`, {
          return_id: ret.return_id,
          status: ret.status,
          reason: ret.reason,
          return_type: ret.return_type,
          created_at: ret.created_at,
          updated_at: ret.updated_at
        });
      });
    } else {
      console.log('❌ Không có bản ghi hoàn trả nào');
    }
    
    // Test API endpoint cập nhật trạng thái
    console.log('\n=== TEST API ENDPOINT ===');
    console.log('Endpoint: PUT /api/orders/190/return-status');
    console.log('Payload example: { "return_status": "PENDING" }');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

debugOrder190();
