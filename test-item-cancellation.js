// Test script for order item cancellation functionality
const fetch = require('node-fetch');

const baseUrl = 'http://localhost:3501';
const orderId = 476; // Order có 2 sản phẩm

// Simulate auth token (replace with real token)
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NjA0MjM0NCwiZXhwIjoxNzU2MTI4NzQ0fQ.9-RgsDSCivqzgU3TzClSuU-90c5jiwc4xlqeQMxQ9H0';

async function testOrderItemsFunctions() {
  console.log('🧪 Testing Order Items Functions');
  console.log('=================================');
  
  try {
    // Test 1: Lấy danh sách sản phẩm trong đơn hàng
    console.log('\n📋 Test 1: Get Order Items');
    console.log('---------------------------');
    
    const itemsResponse = await fetch(`${baseUrl}/api/orders-id/items/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (itemsResponse.ok) {
      const itemsData = await itemsResponse.json();
      console.log('✅ Successfully fetched order items');
      console.log('Order:', itemsData.data.order);
      console.log('Summary:', itemsData.data.summary);
      console.log('Items:');
      itemsData.data.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.product.name}`);
        console.log(`     - Item ID: ${item.item_id}`);
        console.log(`     - Quantity: ${item.quantity}`);
        console.log(`     - Price: ${item.price.toLocaleString('vi-VN')}đ`);
        console.log(`     - Status: ${item.status}`);
        console.log(`     - Can Cancel: ${item.can_cancel}`);
      });
      
      // Test 2: Hủy một sản phẩm cụ thể
      const firstItem = itemsData.data.items.find(item => item.can_cancel);
      if (firstItem) {
        console.log(`\n❌ Test 2: Cancel Item "${firstItem.product.name}"`);
        console.log('--------------------------------------------------');
        
        const cancelResponse = await fetch(`${baseUrl}/api/orders-id/cancel-item/${orderId}/${firstItem.item_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason: 'Test cancellation - khách hàng đổi ý về sản phẩm này'
          })
        });
        
        if (cancelResponse.ok) {
          const cancelData = await cancelResponse.json();
          console.log('✅ Successfully cancelled item');
          console.log('Response:', JSON.stringify(cancelData, null, 2));
        } else {
          const errorData = await cancelResponse.text();
          console.log('❌ Failed to cancel item');
          console.log('Status:', cancelResponse.status);
          console.log('Error:', errorData);
        }
      } else {
        console.log('\n⚠️  No cancellable items found in this order');
      }
      
    } else {
      const errorData = await itemsResponse.text();
      console.log('❌ Failed to fetch order items');
      console.log('Status:', itemsResponse.status);
      console.log('Error:', errorData);
    }
    
    // Test 3: Lấy lại danh sách sản phẩm sau khi hủy
    console.log('\n📋 Test 3: Get Order Items After Cancellation');
    console.log('----------------------------------------------');
    
    setTimeout(async () => {
      const afterCancelResponse = await fetch(`${baseUrl}/api/orders-id/items/${orderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (afterCancelResponse.ok) {
        const afterCancelData = await afterCancelResponse.json();
        console.log('✅ Order items after cancellation:');
        console.log('Summary:', afterCancelData.data.summary);
        afterCancelData.data.items.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.product.name} - Status: ${item.status}`);
        });
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test database queries directly
async function testDatabaseQueries() {
  console.log('\n🗄️  Testing Database Queries');
  console.log('============================');
  
  try {
    const db = require('./config/database');
    
    // Check order items
    const [items] = await db.query(`
      SELECT oi.order_item_id, oi.current_status, p.product_name, oi.quantity, oi.product_price
      FROM order_items oi
      LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
      LEFT JOIN product p ON vp.product_id = p.product_id
      WHERE oi.order_id = ?
    `, [orderId]);
    
    console.log(`Order ${orderId} has ${items.length} items:`);
    items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.product_name}`);
      console.log(`     - Item ID: ${item.order_item_id}`);
      console.log(`     - Status: ${item.current_status}`);
      console.log(`     - Quantity: ${item.quantity}`);
      console.log(`     - Price: ${Number(item.product_price).toLocaleString('vi-VN')}đ`);
    });
    
    // Check order total
    const [[order]] = await db.query('SELECT order_total, order_total_final FROM orders WHERE order_id = ?', [orderId]);
    console.log(`\nOrder totals:`);
    console.log(`  - Subtotal: ${Number(order.order_total).toLocaleString('vi-VN')}đ`);
    console.log(`  - Final Total: ${Number(order.order_total_final).toLocaleString('vi-VN')}đ`);
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

// Run tests
(async () => {
  console.log('🚀 SONA SPACE Server - Order Item Cancellation Test');
  console.log('===================================================');
  
  await testDatabaseQueries();
  
  console.log('\n⚠️  Note: API tests require valid authentication token');
  console.log('To test API endpoints, please:');
  console.log('1. Login to get auth token');
  console.log('2. Replace "your-auth-token-here" with real token');
  console.log('3. Run this script again');
  
  // Uncomment the line below if you have a valid auth token
  // await testOrderItemsFunctions();
})();
