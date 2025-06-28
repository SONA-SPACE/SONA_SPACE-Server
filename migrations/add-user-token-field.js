/**
 * Migration script để thêm trường user_token vào bảng user
 * Chạy script này bằng lệnh: node migrations/add-user-token-field.js
 */

const db = require('../config/database');

async function addUserTokenField() {
  try {
    console.log('Bắt đầu migration: Thêm trường user_token vào bảng user');

    // Kiểm tra xem trường user_token đã tồn tại trong bảng user chưa
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'user_token'
    `);

    // Nếu trường user_token chưa tồn tại, thêm nó vào
    if (columns.length === 0) {
      console.log('Trường user_token chưa tồn tại. Đang thêm trường...');
      
      await db.query(`
        ALTER TABLE user 
        ADD COLUMN user_token TEXT DEFAULT NULL COMMENT 'JWT token của người dùng'
      `);
      
      console.log('Đã thêm trường user_token vào bảng user thành công');
    } else {
      console.log('Trường user_token đã tồn tại trong bảng user');
    }

    // Kiểm tra xem trường updated_at đã tồn tại trong bảng user chưa
    const [updatedAtColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user' 
      AND COLUMN_NAME = 'updated_at'
    `);

    // Nếu trường updated_at chưa tồn tại, thêm nó vào
    if (updatedAtColumns.length === 0) {
      console.log('Trường updated_at chưa tồn tại. Đang thêm trường...');
      
      await db.query(`
        ALTER TABLE user 
        ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật'
      `);
      
      console.log('Đã thêm trường updated_at vào bảng user thành công');
    } else {
      console.log('Trường updated_at đã tồn tại trong bảng user');
    }

    console.log('Migration hoàn tất');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi thực hiện migration:', error);
    process.exit(1);
  }
}

// Chạy migration
addUserTokenField(); 