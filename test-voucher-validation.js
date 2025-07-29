const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "troi_oi";

// Tạo token cho user ID 2 (có quyền dùng voucher)
const tokenUser2 = jwt.sign({ id: 2, email: "user2@test.com", role: "user" }, JWT_SECRET, { expiresIn: '90d' });

// Tạo token cho user ID 1 (KHÔNG có quyền dùng voucher)  
const tokenUser1 = jwt.sign({ id: 1, email: "user1@test.com", role: "user" }, JWT_SECRET, { expiresIn: '90d' });

async function testVoucherValidation() {
  try {
    const voucherCode = "SORRY20-295429"; // Voucher vừa tạo cho user ID 2
    
    console.log("=== TEST VALIDATE VOUCHER ===");
    console.log(`Voucher code: ${voucherCode}`);
    
    // Test 1: User ID 2 (có quyền) validate voucher
    console.log("\n--- Test 1: User ID 2 (có quyền) ---");
    const response1 = await fetch('http://localhost:3501/api/couponcodes/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenUser2}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: voucherCode,
        cart_total: 500000 // 500k
      })
    });
    
    const data1 = await response1.json();
    console.log(`Status: ${response1.status}`);
    console.log('Response:', JSON.stringify(data1, null, 2));
    
    // Test 2: User ID 1 (KHÔNG có quyền) validate voucher
    console.log("\n--- Test 2: User ID 1 (KHÔNG có quyền) ---");
    const response2 = await fetch('http://localhost:3501/api/couponcodes/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenUser1}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: voucherCode,
        cart_total: 500000 // 500k
      })
    });
    
    const data2 = await response2.json();
    console.log(`Status: ${response2.status}`);
    console.log('Response:', JSON.stringify(data2, null, 2));
    
  } catch (error) {
    console.error('Lỗi:', error.message);
  }
}

testVoucherValidation();
