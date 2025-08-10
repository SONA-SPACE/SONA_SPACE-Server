const jwt = require('jsonwebtoken');

// Tạo token mới với thông tin chính xác
const JWT_SECRET = process.env.JWT_SECRET || "troi_oi";

const payload = {
  id: 53,
  email: "nguyenhongthai0802@gmail.com", 
  role: "admin"
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '90d' });

async function testApologyEmail() {
  try {
    console.log("Generated token:", token);
    
    // Test API gửi email xin lỗi cho đơn hàng ID 318
    console.log('📧 Đang test API gửi email xin lỗi cho đơn hàng ID 318...');
    
    const requestBody = {
      reason: 'Sự cố kỹ thuật hệ thống thanh toán',
      message: 'Chúng tôi gặp sự cố kỹ thuật trong việc xử lý thanh toán đơn hàng của quý khách. Chúng tôi xin lỗi về sự bất tiện này và đang khắc phục ngay lập tức. Đơn hàng của quý khách sẽ được ưu tiên xử lý sau khi hệ thống hoạt động trở lại.'
    };
    
    const response = await fetch('http://localhost:3501/api/orders/318/send-apology-email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('✅ API Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('\n🎫 Voucher code:', data.data.voucherCode);
      console.log('📧 Email sent to:', data.data.recipientEmail);
    }
    
  } catch (error) {
    console.error('❌ Lỗi khi test API:', error.message);
  }
}

testApologyEmail();

// Chạy test
testApologyEmail();
