// Test script for dashboard order detail endpoint
const fetch = require('node-fetch');

async function testOrderDetail() {
  try {
    console.log('Testing order detail endpoint...');
    
    // Test the endpoint that was failing
    const orderId = 467;
    const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add any required auth headers if needed
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response statusText:', response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Order data received:', {
        orderId: data.data?.order_id || data.order_id,
        status: data.data?.status || data.status,
        hasItems: data.data?.items ? data.data.items.length : 'unknown'
      });
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Test direct database connection
async function testDatabaseConnection() {
  try {
    console.log('\nTesting database connection...');
    const db = require('./config/database');
    
    const [result] = await db.query('SELECT COUNT(*) as count FROM orders WHERE order_id = ?', [467]);
    console.log('Order 467 exists in database:', result[0].count > 0);
    
    if (result[0].count > 0) {
      const [orderData] = await db.query(
        `SELECT o.*, u.user_name as customer_name 
         FROM orders o 
         LEFT JOIN user u ON o.user_id = u.user_id 
         WHERE o.order_id = ? LIMIT 1`, 
        [467]
      );
      console.log('Order details:', {
        orderId: orderData[0].order_id,
        status: orderData[0].status,
        customerName: orderData[0].customer_name
      });
    }
    
  } catch (error) {
    console.error('Database test failed:', error.message);
  }
}

// Run tests
(async () => {
  console.log('🧪 SONA SPACE Server - Order Detail Test');
  console.log('=========================================');
  
  await testDatabaseConnection();
  
  // Wait a bit for server to be ready
  setTimeout(async () => {
    await testOrderDetail();
    console.log('\nTest completed! Check the results above.');
  }, 2000);
})();
