const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "troi_oi";

// Token cho user ID 2 (có voucher)
const tokenUser2 = jwt.sign({ id: 2, email: "user2@test.com", role: "user" }, JWT_SECRET, { expiresIn: '90d' });

// Token cho user ID 1 (không có voucher)
const tokenUser1 = jwt.sign({ id: 1, email: "user1@test.com", role: "user" }, JWT_SECRET, { expiresIn: '90d' });

async function testUserHasCoupon() {
  try {
    console.log("=== TEST API /user-has-coupon ===");
    
    // Test 1: User ID 2 (có voucher)
    console.log("\n--- User ID 2 (có voucher) ---");
    const response1 = await fetch('http://localhost:3501/api/couponcodes/user-has-coupon', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenUser2}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data1 = await response1.json();
    console.log(`Status: ${response1.status}`);
    console.log('Voucher của user ID 2:');
    console.table(data1.map(v => ({
      code: v.code,
      discount: `${v.discount}%`,
      description: v.description,
      validUntil: new Date(v.validUntil).toLocaleDateString('vi-VN'),
      status: v.status === 0 ? 'Chưa dùng' : 'Đã dùng'
    })));
    
    // Test 2: User ID 1 (không có voucher)
    console.log("\n--- User ID 1 (không có voucher) ---");
    const response2 = await fetch('http://localhost:3501/api/couponcodes/user-has-coupon', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenUser1}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data2 = await response2.json();
    console.log(`Status: ${response2.status}`);
    console.log(`Số voucher của user ID 1: ${data2.length}`);
    if (data2.length > 0) {
      console.table(data2.map(v => ({
        code: v.code,
        discount: `${v.discount}%`,
        description: v.description
      })));
    } else {
      console.log('User ID 1 không có voucher nào.');
    }
    
  } catch (error) {
    console.error('Lỗi:', error.message);
  }
}

testUserHasCoupon();
