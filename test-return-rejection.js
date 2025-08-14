const axios = require('axios');

// Test configuration
const API_BASE = 'http://localhost:3501';

// Admin token - replace with actual admin token
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNTU1NDEzMH0.y0OOQzG-7wfIxgJGcZqTY3sJ5oQnQJBJPmlZNJUWQ9w';

async function testReturnRejection() {
  console.log('🧪 Testing Return Rejection Email Notification');
  console.log('='.repeat(50));

  try {
    // Step 1: Get an order with PENDING return status
    console.log('\n📋 Step 1: Finding orders with return status...');
    
    const ordersResponse = await axios.get(`${API_BASE}/api/orders`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });

    const ordersWithReturns = ordersResponse.data.filter(order => 
      order.returnInfo && order.returnInfo.return_status === 'PENDING'
    );

    if (ordersWithReturns.length === 0) {
      console.log('❌ No orders with PENDING return status found');
      
      // Create a test return request first
      console.log('\n📝 Creating a test return request...');
      
      // Get any order to create a return request
      const anyOrder = ordersResponse.data[0];
      if (!anyOrder) {
        console.log('❌ No orders found to test with');
        return;
      }

      console.log(`Using order ID: ${anyOrder.id}`);
      
      // First set return status to PENDING
      try {
        await axios.put(`${API_BASE}/api/orders/${anyOrder.id}/return-status`, 
          { return_status: 'PENDING' },
          { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
        );
        console.log('✅ Set order return status to PENDING');
      } catch (error) {
        console.log('⚠️ Could not set PENDING status, continuing with existing order...');
      }
    }

    // Use the first order found or the one we just modified
    const testOrder = ordersWithReturns[0] || ordersResponse.data[0];
    
    if (!testOrder) {
      console.log('❌ No suitable order found for testing');
      return;
    }

    console.log(`\n🎯 Using Order ID: ${testOrder.id}`);
    console.log(`📧 Customer Email: ${testOrder.order_email_new || testOrder.user_email || 'N/A'}`);
    console.log(`👤 Customer Name: ${testOrder.order_name_new || testOrder.user_name || 'N/A'}`);
    
    // Step 2: Update return status to REJECTED
    console.log('\n📋 Step 2: Rejecting return request...');
    
    const rejectionResponse = await axios.put(
      `${API_BASE}/api/orders/${testOrder.id}/return-status`,
      { return_status: 'REJECTED' },
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );

    console.log('✅ Return rejection response:', rejectionResponse.data);

    // Step 3: Verify order status was updated
    console.log('\n📋 Step 3: Verifying order status...');
    
    const updatedOrderResponse = await axios.get(
      `${API_BASE}/api/orders/${testOrder.id}`,
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );

    const updatedOrder = updatedOrderResponse.data;
    console.log(`✅ Current return status: ${updatedOrder.returnInfo?.return_status || 'N/A'}`);
    console.log(`✅ Status step: ${updatedOrder.status_step || 'N/A'}`);

    // Step 4: Test rejection email template manually
    console.log('\n📧 Step 4: Testing email template...');
    
    const { sendEmail1 } = require('./services/mailService1');
    
    const testEmailData = {
      customerName: testOrder.order_name_new || testOrder.user_name || 'Khách hàng test',
      orderId: testOrder.id,
      orderHash: testOrder.order_hash || 'TEST-HASH',
      orderTotal: new Intl.NumberFormat('vi-VN', { 
        style: 'currency', 
        currency: 'VND' 
      }).format(testOrder.order_total_final || 1000000),
      returnDate: new Date().toLocaleDateString('vi-VN'),
      rejectReason: 'Sản phẩm không còn trong tình trạng ban đầu, có dấu hiệu sử dụng và không thể hoàn trả theo chính sách.'
    };

    const testEmail = testOrder.order_email_new || testOrder.user_email || 'test@example.com';
    
    console.log(`📨 Sending test email to: ${testEmail}`);
    
    const emailResult = await sendEmail1(
      testEmail,
      `[Sona Space] Thông báo từ chối yêu cầu trả hàng - ${testEmailData.orderHash}`,
      testEmailData,
      'return-rejected'
    );

    if (emailResult.success) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Email details:', emailResult.info);
    } else {
      console.log('❌ Email failed:', emailResult.error);
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`• Order ID: ${testOrder.id}`);
    console.log(`• Return Status: REJECTED`);
    console.log(`• Email Sent: ${emailResult.success ? 'Yes' : 'No'}`);
    console.log(`• Customer: ${testEmailData.customerName}`);
    console.log(`• Contact: Phone: 0705768791, Email: nguyenhongthai0802@gmail.com`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📄 Response data:', error.response.data);
      console.error('📊 Status:', error.response.status);
    }
  }
}

// Run the test
if (require.main === module) {
  testReturnRejection()
    .then(() => {
      console.log('\n✅ Test execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testReturnRejection };
