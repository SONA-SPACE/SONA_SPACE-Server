const db = require('./config/database');

async function testOrderQuery() {
  try {
    console.log('Kiểm tra truy vấn đơn hàng...');
    
    // Thử truy vấn đơn giản
    console.log('\n1. Truy vấn đơn giản:');
    const [simpleResult] = await db.query('SELECT COUNT(*) as count FROM `order`');
    console.log('Kết quả:', simpleResult);
    
    // Thử truy vấn JOIN với order_status
    console.log('\n2. Truy vấn JOIN với order_status:');
    const [joinResult1] = await db.query(`
      SELECT o.order_id, os.order_status_name
      FROM \`order\` o
      LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
      LIMIT 1
    `);
    console.log('Kết quả:', joinResult1);
    
    // Thử truy vấn JOIN với user
    console.log('\n3. Truy vấn JOIN với user:');
    const [joinResult2] = await db.query(`
      SELECT o.order_id, u.user_gmail, u.user_name
      FROM \`order\` o
      LEFT JOIN user u ON o.user_id = u.user_id
      LIMIT 1
    `);
    console.log('Kết quả:', joinResult2);
    
    // Thử truy vấn giống như trong endpoint
    console.log('\n4. Truy vấn đầy đủ trong endpoint:');
    const [fullResult] = await db.query(`
      SELECT 
        o.order_id,
        o.order_status_id,
        os.order_status_name as status_name,
        u.user_gmail as user_email,
        u.user_name as user_name
      FROM \`order\` o
      LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
      LEFT JOIN user u ON o.user_id = u.user_id
      LIMIT 1
    `);
    console.log('Kết quả:', fullResult);
    
    console.log('\nKiểm tra hoàn tất.');
  } catch (error) {
    console.error('Lỗi:', error);
  } finally {
    // Đóng kết nối
    process.exit(0);
  }
}

// Thực thi
testOrderQuery(); 