const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'fur.timefortea.io.vn',
  user: 'root',
  password: 'Homelander0108!',
  database: 'sona_space_db',
  port: 3306,
  timezone: '+00:00'
};

async function getAdminPassword() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Đã kết nối đến cơ sở dữ liệu MySQL');

    // Lấy thông tin tài khoản admin sonaspace.furniture@gmail.com
    const [users] = await connection.execute(
      'SELECT user_id, user_gmail, user_name, user_password, user_role FROM user WHERE user_gmail = ?',
      ['sonaspace.furniture@gmail.com']
    );

    if (users.length > 0) {
      console.log('Thông tin tài khoản admin:', {
        user_id: users[0].user_id,
        user_gmail: users[0].user_gmail,
        user_name: users[0].user_name,
        user_role: users[0].user_role,
        password_hash: users[0].user_password
      });
    } else {
      console.log('Không tìm thấy tài khoản admin');
    }

  } catch (error) {
    console.error('Lỗi kết nối cơ sở dữ liệu:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Đã đóng kết nối đến cơ sở dữ liệu');
    }
  }
}

getAdminPassword();
