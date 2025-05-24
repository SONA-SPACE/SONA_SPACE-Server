const db = require('./config/database');

async function testDatabaseConnection() {
  try {
    // Kiểm tra kết nối
    console.log('Đang kết nối đến cơ sở dữ liệu...');
    const connection = await db.getConnection();
    console.log('Kết nối thành công!');
    
    // Kiểm tra bảng order
    console.log('\nCấu trúc bảng `order`:');
    const [orderStructure] = await connection.query('DESCRIBE `order`');
    console.log(orderStructure);
    
    // Kiểm tra bảng order_status
    console.log('\nCấu trúc bảng order_status:');
    const [statusStructure] = await connection.query('DESCRIBE order_status');
    console.log(statusStructure);
    
    // Đếm số lượng đơn hàng
    console.log('\nĐếm số lượng đơn hàng:');
    const [orderCount] = await connection.query('SELECT COUNT(*) as total FROM `order`');
    console.log(`Tổng số đơn hàng: ${orderCount[0].total}`);
    
    // Kiểm tra một đơn hàng cụ thể
    console.log('\nThông tin đơn hàng đầu tiên:');
    const [firstOrder] = await connection.query('SELECT * FROM `order` LIMIT 1');
    if (firstOrder.length > 0) {
      console.log(firstOrder[0]);
    } else {
      console.log('Không có đơn hàng nào trong cơ sở dữ liệu');
    }
    
    // Thử thực hiện truy vấn giống như trong endpoint /api/orders
    console.log('\nThử truy vấn JOIN với user:');
    try {
      const [orders] = await connection.query(`
        SELECT 
          o.*,
          os.order_status_name as status_name,
          u.user_gmail as user_email,
          u.user_name as user_name
        FROM \`order\` o
        LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
        LEFT JOIN user u ON o.user_id = u.user_id
        LIMIT 1
      `);
      console.log('Kết quả truy vấn:');
      if (orders.length > 0) {
        console.log(orders[0]);
      } else {
        console.log('Không có kết quả');
      }
    } catch (error) {
      console.error('Lỗi khi thực hiện truy vấn JOIN:', error.message);
    }
    
    // Giải phóng kết nối
    connection.release();
    console.log('\nĐã đóng kết nối');
  } catch (error) {
    console.error('Lỗi:', error);
  }
}

// Thực thi
testDatabaseConnection().then(() => {
  process.exit(0);
}); 