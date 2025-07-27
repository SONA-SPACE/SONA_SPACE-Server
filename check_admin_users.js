const mysql = require('mysql2/promise');

async function checkAdminUsers() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'fur.timefortea.io.vn',
      user: 'thainguyen0802',
      password: 'cegatcn!080297',
      database: 'furnitown',
      port: 3306
    });
    
    console.log('=== KIỂM TRA USERS ADMIN ===');
    
    // Kiểm tra user ID 3
    const [user3] = await connection.query(
      'SELECT user_id, user_name, user_gmail, user_role FROM user WHERE user_id = 3'
    );
    console.log('User ID 3:', user3[0] || 'Không tồn tại');
    
    // Tìm tất cả admin users
    const [adminUsers] = await connection.query(
      'SELECT user_id, user_name, user_gmail, user_role FROM user WHERE user_role = "admin"'
    );
    console.log('\nTất cả admin users:');
    if (adminUsers.length > 0) {
      adminUsers.forEach((admin, index) => {
        console.log(`${index + 1}.`, admin);
      });
    } else {
      console.log('Không có admin users nào');
    }
    
    // Kiểm tra tất cả user roles
    const [allRoles] = await connection.query(
      'SELECT DISTINCT user_role, COUNT(*) as count FROM user GROUP BY user_role'
    );
    console.log('\nPhân phối roles:');
    allRoles.forEach(role => {
      console.log(`- ${role.user_role || 'NULL'}: ${role.count} users`);
    });
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAdminUsers();
