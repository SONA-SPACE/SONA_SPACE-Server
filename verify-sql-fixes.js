const db = require('./config/database');

async function verifyPaymentQueries() {
  console.log('Verifying SQL queries for payments...');
  
  try {
    // Test query 1: Fetch all payments (limited to 5)
    console.log('\n1. Testing query to fetch payments:');
    const query1 = `
      SELECT 
        p.*,
        o.order_hash,
        u.user_name,
        u.user_gmail as user_email
      FROM payment p
      LEFT JOIN \`order\` o ON p.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      ORDER BY p.created_at DESC
      LIMIT 0, 5
    `;
    
    const [payments] = await db.query(query1);
    console.log(`Query executed successfully. Returned ${payments.length} payments.`);
    if (payments.length > 0) {
      console.log('First payment:', JSON.stringify(payments[0], null, 2).substring(0, 500) + '...');
    }
    
    // Test query 2: Fetch payment by ID
    console.log('\n2. Testing query to fetch payment by ID:');
    // Use the first payment ID from previous query if available, otherwise use 1
    const paymentId = payments.length > 0 ? payments[0].payment_id : 1;
    const query2 = `
      SELECT 
        p.*,
        o.order_hash,
        o.order_total,
        u.user_name,
        u.user_gmail as user_email
      FROM payment p
      LEFT JOIN \`order\` o ON p.order_id = o.order_id
      LEFT JOIN user u ON o.user_id = u.user_id
      WHERE p.payment_id = ?
    `;
    
    const [paymentDetails] = await db.query(query2, [paymentId]);
    console.log(`Query executed successfully. Returned ${paymentDetails.length} payment details.`);
    if (paymentDetails.length > 0) {
      console.log('Payment details:', JSON.stringify(paymentDetails[0], null, 2).substring(0, 500) + '...');
    }
    
    // Test query 3: Fetch order by ID
    console.log('\n3. Testing query to fetch order by ID:');
    // Use the order_id from the first payment if available, otherwise use 1
    const orderId = payments.length > 0 && payments[0].order_id ? payments[0].order_id : 1;
    const query3 = 'SELECT * FROM `order` WHERE order_id = ?';
    
    const [orders] = await db.query(query3, [orderId]);
    console.log(`Query executed successfully. Returned ${orders.length} orders.`);
    if (orders.length > 0) {
      console.log('Order details:', JSON.stringify(orders[0], null, 2).substring(0, 500) + '...');
    }
    
    // Test query 4: Fetch payments for an order
    console.log('\n4. Testing query to fetch payments for an order:');
    const query4 = 'SELECT * FROM payment WHERE order_id = ?';
    
    const [orderPayments] = await db.query(query4, [orderId]);
    console.log(`Query executed successfully. Returned ${orderPayments.length} payments for order.`);
    if (orderPayments.length > 0) {
      console.log('First payment for order:', JSON.stringify(orderPayments[0], null, 2).substring(0, 500) + '...');
    }
    
    console.log('\nAll queries executed successfully! SQL fixes appear to be working.');
  } catch (error) {
    console.error('Error verifying SQL queries:', error);
  } finally {
    // Close the database connection
    db.end();
  }
}

// Run the verification
verifyPaymentQueries(); 