const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'fur.timefortea.io.vn',
    user: process.env.DB_USERNAME || 'thainguyen0802', 
    password: process.env.DB_PASSWORD || 'Cegatcn!080297',
    database: process.env.DB_DATABASE || 'furnitown'
};

async function checkOrderStatuses() {
    console.log('🔍 Checking order statuses in database...');
    
    try {
        const db = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected');
        
        // Kiểm tra các orders và trạng thái của chúng
        const [orders] = await db.query(`
            SELECT order_id, order_hash, user_id, current_status, created_at, 
                   order_total_final, status_updated_by, status_updated_at
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        console.log('\n📊 Recent orders:');
        orders.forEach(order => {
            const hoursDiff = (new Date() - new Date(order.created_at)) / (1000 * 60 * 60);
            console.log(`  Order ${order.order_id} (${order.order_hash}):
    User ID: ${order.user_id}
    Status: ${order.current_status}
    Created: ${order.created_at} (${hoursDiff.toFixed(1)} hours ago)
    Updated by: ${order.status_updated_by || 'N/A'}
    Total: ${order.order_total_final}`);
        });
        
        // Tìm orders có thể hủy được (PENDING hoặc CONFIRMED và < 24h)
        const [cancellableOrders] = await db.query(`
            SELECT order_id, order_hash, user_id, current_status, created_at
            FROM orders 
            WHERE current_status IN ('PENDING', 'CONFIRMED')
            AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            LIMIT 5
        `);
        
        console.log('\n✅ Cancellable orders (PENDING/CONFIRMED & < 24h):');
        if (cancellableOrders.length === 0) {
            console.log('  No cancellable orders found');
        } else {
            cancellableOrders.forEach(order => {
                const hoursDiff = (new Date() - new Date(order.created_at)) / (1000 * 60 * 60);
                console.log(`  Order ${order.order_id} (${order.order_hash}): ${order.current_status} - ${hoursDiff.toFixed(1)}h ago`);
            });
        }
        
        // Kiểm tra order_returns table
        const [returns] = await db.query(`
            SELECT COUNT(*) as count FROM order_returns
        `);
        console.log(`\n📦 Total order returns in database: ${returns[0].count}`);
        
        await db.end();
        console.log('\n✅ Database check completed!');
        
    } catch (error) {
        console.error('❌ Error checking database:', error.message);
    }
}

checkOrderStatuses();
