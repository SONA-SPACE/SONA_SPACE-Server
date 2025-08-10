const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'fur.timefortea.io.vn',
    user: process.env.DB_USERNAME || 'thainguyen0802', 
    password: process.env.DB_PASSWORD || 'Cegatcn!080297',
    database: process.env.DB_DATABASE || 'furnitown'
};

async function checkOrdersTable() {
    console.log('🔍 Checking orders table structure...');
    
    try {
        const db = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected');
        
        // Check orders table structure
        console.log('\n📋 Table: orders');
        const [orderColumns] = await db.query('DESCRIBE orders');
        orderColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
        });
        
        // Sample data
        console.log('\n📊 Sample orders data...');
        const [sampleOrders] = await db.query('SELECT * FROM orders LIMIT 3');
        console.log('Sample orders:', sampleOrders);
        
        await db.end();
        console.log('\n✅ Orders table check completed!');
        
    } catch (error) {
        console.error('❌ Error checking orders table:', error.message);
    }
}

checkOrdersTable();
