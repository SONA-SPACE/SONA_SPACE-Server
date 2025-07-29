const db = require('./config/database');

async function checkVoucherAssignment() {
  try {
    console.log("=== KIỂM TRA VOUCHER ĐÃ GÁN CHO USER ===");
    
    // Lấy voucher vừa tạo
    const [vouchers] = await db.query(`
      SELECT c.*, uhc.user_id as assigned_user_id
      FROM couponcode c
      LEFT JOIN user_has_coupon uhc ON c.couponcode_id = uhc.couponcode_id
      WHERE c.code LIKE 'SORRY20-%'
      ORDER BY c.couponcode_id DESC 
      LIMIT 3
    `);
    
    console.log("Voucher xin lỗi gần đây:");
    console.table(vouchers.map(v => ({
      code: v.code,
      title: v.title,
      discount: `${v.value_price}%`,
      assigned_to_user: v.assigned_user_id || 'CÔNG KHAI',
      status: v.status,
      exp_time: v.exp_time
    })));
    
    // Kiểm tra user_id = 2 có thể sử dụng voucher không
    const latestVoucher = vouchers[0];
    if (latestVoucher && latestVoucher.assigned_user_id) {
      console.log(`\n=== TEST QUYỀN SỬ DỤNG VOUCHER ${latestVoucher.code} ===`);
      
      // Test user đúng (user_id = 2)
      const [userCanUse] = await db.query(`
        SELECT 1 FROM user_has_coupon 
        WHERE couponcode_id = ? AND user_id = ?
      `, [latestVoucher.couponcode_id, 2]);
      
      console.log(`User ID 2 có quyền sử dụng: ${userCanUse.length > 0 ? 'CÓ' : 'KHÔNG'}`);
      
      // Test user khác (user_id = 1)
      const [otherUserCanUse] = await db.query(`
        SELECT 1 FROM user_has_coupon 
        WHERE couponcode_id = ? AND user_id = ?
      `, [latestVoucher.couponcode_id, 1]);
      
      console.log(`User ID 1 có quyền sử dụng: ${otherUserCanUse.length > 0 ? 'CÓ' : 'KHÔNG'}`);
    }
    
  } catch (error) {
    console.error('Lỗi:', error.message);
  } finally {
    process.exit(0);
  }
}

checkVoucherAssignment();
