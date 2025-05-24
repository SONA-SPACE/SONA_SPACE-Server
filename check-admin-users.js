const mysql = require('mysql2/promise');

// Thông tin kết nối cơ sở dữ liệu
const dbConfig = {
  host: 'fur.timefortea.io.vn',
  user: 'thainguyen0802',
  password: 'cegatcn!080297',
  database: 'furnitown',
  port: 3306
};

async function checkAdminUsers() {
  try {
    // Tạo kết nối đến cơ sở dữ liệu
    const connection = await mysql.createConnection(dbConfig);

    console.log('Đã kết nối đến cơ sở dữ liệu MySQL');

    // Kiểm tra các user có quyền admin
    const [rows] = await connection.query('SELECT user_id, user_gmail, user_name, user_role FROM user');
    console.log('Danh sách người dùng:');
    console.log(rows);

    // Tìm người dùng có quyền admin
    const adminUsers = rows.filter(user => user.user_role === 'admin');
    console.log('\nDanh sách người dùng có quyền admin:');
    console.log(adminUsers);

    // Đóng kết nối
    await connection.end();
    console.log('Đã đóng kết nối đến cơ sở dữ liệu');
  } catch (error) {
    console.error('Lỗi:', error);
  }
}

// Thực thi hàm
checkAdminUsers(); 