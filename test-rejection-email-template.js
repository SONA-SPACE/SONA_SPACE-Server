const { sendEmail1 } = require('./services/mailService1');

async function testEmailTemplate() {
  console.log('🧪 Testing Return Rejection Email Template');
  console.log('='.repeat(50));

  try {
    // Test data for email template
    const emailData = {
      customerName: 'Nguyễn Văn A',
      orderId: 435,
      orderHash: 'ORD-435-ABCD1234',
      orderTotal: new Intl.NumberFormat('vi-VN', { 
        style: 'currency', 
        currency: 'VND' 
      }).format(2500000),
      returnDate: new Date().toLocaleDateString('vi-VN'),
      rejectReason: 'Sản phẩm đã được sử dụng và có dấu hiệu hư hỏng không thể hoàn trả theo chính sách của công ty. Sản phẩm nội thất cần được giữ nguyên vẹn và trong tình trạng ban đầu để có thể trả lại.'
    };

    console.log('\n📧 Email Data:');
    console.log('Customer:', emailData.customerName);
    console.log('Order ID:', emailData.orderId);
    console.log('Order Hash:', emailData.orderHash);
    console.log('Total:', emailData.orderTotal);
    console.log('Return Date:', emailData.returnDate);
    console.log('Reason:', emailData.rejectReason);

    console.log('\n📨 Sending rejection email...');
    
    const emailResult = await sendEmail1(
      'nguyenhongthai0802@gmail.com', // Test email
      `[Sona Space] Thông báo từ chối yêu cầu trả hàng - ${emailData.orderHash}`,
      emailData,
      'return-rejected'
    );

    if (emailResult.success) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Email details:', emailResult.info?.response || 'Email sent');
    } else {
      console.log('❌ Email failed:', emailResult.error);
    }

    console.log('\n🎉 Template test completed!');
    console.log('\n📋 Summary:');
    console.log(`• Template: return-rejected.ejs`);
    console.log(`• Email Status: ${emailResult.success ? 'Success' : 'Failed'}`);
    console.log(`• Recipient: nguyenhongthai0802@gmail.com`);
    console.log(`• Subject: [Sona Space] Thông báo từ chối yêu cầu trả hàng - ${emailData.orderHash}`);
    console.log('\n💼 Supplier Contact Info in Email:');
    console.log('• Phone: 0705768791');
    console.log('• Email: nguyenhongthai0802@gmail.com');
    console.log('• Hours: 8:00 - 17:00 (Mon - Fri)');

  } catch (error) {
    console.error('❌ Template test failed:', error.message);
    console.error('📊 Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testEmailTemplate()
    .then(() => {
      console.log('\n✅ Template test execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Template test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testEmailTemplate };
