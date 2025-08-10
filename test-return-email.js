const fetch = require('node-fetch');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'fur.timefortea.io.vn',
    user: process.env.DB_USERNAME || 'thainguyen0802', 
    password: process.env.DB_PASSWORD || 'Cegatcn!080297',
    database: process.env.DB_DATABASE || 'furnitown'
};

async function testOrderSN53858194() {
    console.log('🔍 Testing order SN53858194 for return email functionality...');
    
    try {
        // Connect to database
        const db = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected');
        
        // Check if order exists
        const [orderResult] = await db.query(
            `SELECT o.order_id, o.order_hash, o.current_status, o.user_id,
                    o.order_name_new, o.order_email_new, 
                    u.user_name, u.user_gmail as user_email
             FROM orders o
             LEFT JOIN user u ON o.user_id = u.user_id
             WHERE o.order_hash = ?`,
            ['SN53858194']
        );
        
        if (orderResult.length === 0) {
            console.log('❌ Order SN53858194 not found');
            await db.end();
            return;
        }
        
        const order = orderResult[0];
        console.log('📦 Order found:', {
            order_id: order.order_id,
            order_hash: order.order_hash,
            status: order.current_status,
            customer_name: order.order_name_new || order.user_name,
            customer_email: order.order_email_new || order.user_email
        });
        
        // Check if there are any return records
        const [returnResult] = await db.query(
            `SELECT return_id, status, reason, return_type, total_refund, created_at
             FROM order_returns 
             WHERE order_id = ?
             ORDER BY created_at DESC`,
            [order.order_id]
        );
        
        console.log(`📋 Return records found: ${returnResult.length}`);
        if (returnResult.length > 0) {
            returnResult.forEach((ret, index) => {
                console.log(`  ${index + 1}. Return ID: ${ret.return_id}, Status: ${ret.status}, Type: ${ret.return_type}`);
            });
        }
        
        await db.end();
        
        // Test the email endpoint if it exists
        await testEmailEndpoint(order);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testEmailEndpoint(order) {
    console.log('\n📧 Testing email endpoints...');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NDg0NzU5NCwiZXhwIjoxNzU0OTMzOTk0fQ.RVzmulByZ6DHE0FL5anoCDqwphqJbGgJOKS2KabbS0U';
    
    // Test the email test endpoint
    try {
        console.log('🧪 Testing email functionality with test endpoint...');
        const response = await fetch('http://localhost:3501/api/orders/test-email');
        console.log(`📊 Email test response: ${response.status}`);
        
        if (response.ok) {
            const result = await response.text();
            console.log('✅ Email test result:', result);
        } else {
            console.log('❌ Email test failed');
        }
    } catch (error) {
        console.log('❌ Email test endpoint error:', error.message);
    }
    
    // Test return status update (this should trigger email)
    try {
        console.log('\n🔄 Testing return status update...');
        const updateResponse = await fetch(`http://localhost:3501/api/orders/${order.order_id}/return-status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                return_status: 'APPROVED'
            })
        });
        
        console.log(`📊 Return status update response: ${updateResponse.status}`);
        const updateResult = await updateResponse.text();
        console.log('📄 Update result:', updateResult);
        
    } catch (error) {
        console.log('❌ Return status update error:', error.message);
    }
}

testOrderSN53858194();
