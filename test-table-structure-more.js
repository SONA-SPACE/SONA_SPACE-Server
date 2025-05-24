const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function checkTableStructure() {
  try {
    // Kết nối đến cơ sở dữ liệu
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sona_space'
    });

    console.log('Kết nối đến cơ sở dữ liệu thành công!');

    // Danh sách các bảng cần kiểm tra
    const tables = ['order_items'];

    // Kiểm tra cấu trúc của từng bảng
    for (const table of tables) {
      console.log(`\n=== Cấu trúc bảng ${table} ===`);
      
      // Lấy thông tin về cấu trúc bảng
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      
      // Hiển thị thông tin về các cột
      console.log('Danh sách các cột:');
      columns.forEach((column, index) => {
        console.log(`${index + 1}. ${column.Field} (${column.Type})${column.Key === 'PRI' ? ' - PRIMARY KEY' : ''}`);
      });
      
      // Lấy 5 bản ghi đầu tiên để xem dữ liệu mẫu
      console.log(`\nDữ liệu mẫu từ bảng ${table} (5 bản ghi đầu tiên):`);
      const [rows] = await connection.query(`SELECT * FROM \`${table}\` LIMIT 5`);
      
      if (rows.length > 0) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        console.log('Không có dữ liệu trong bảng này.');
      }
    }

    // Đóng kết nối
    await connection.end();
    console.log('\nĐã đóng kết nối đến cơ sở dữ liệu.');
  } catch (error) {
    console.error('Lỗi:', error);
  }
}

// Chạy hàm kiểm tra
checkTableStructure(); 