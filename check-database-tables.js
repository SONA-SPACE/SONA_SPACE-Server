const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'fur.timefortea.io.vn',
    user: process.env.DB_USERNAME || 'thainguyen0802', 
    password: process.env.DB_PASSWORD || 'Cegatcn!080297',
    database: process.env.DB_DATABASE || 'furnitown'
};

async function checkDatabaseTables() {
    console.log('🔍 Checking database tables for coupon functionality...');
    
    try {
        const db = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected');
        
        // Check couponcode table structure
        console.log('\n📋 Table: couponcode');
        const [couponColumns] = await db.query('DESCRIBE couponcode');
        couponColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
        });
        
        // Check user_has_coupon table structure
        console.log('\n📋 Table: user_has_coupon');
        const [userCouponColumns] = await db.query('DESCRIBE user_has_coupon');
        userCouponColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
        });
        
        // Check notifications table structure
        console.log('\n📋 Table: notifications');
        const [notificationColumns] = await db.query('DESCRIBE notifications');
        notificationColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
        });
        
        // Check user_notifications table structure
        console.log('\n📋 Table: user_notifications');
        const [userNotificationColumns] = await db.query('DESCRIBE user_notifications');
        userNotificationColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
        });
        
        // Check notification_types table structure
        console.log('\n📋 Table: notification_types');
        const [notificationTypeColumns] = await db.query('DESCRIBE notification_types');
        notificationTypeColumns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT: ${col.Default}` : ''}`);
        });
        
        // Check if coupon notification type exists
        console.log('\n🔍 Checking notification types...');
        const [notificationTypes] = await db.query('SELECT * FROM notification_types WHERE type_code = "coupon"');
        if (notificationTypes.length > 0) {
            console.log('✅ Coupon notification type exists:', notificationTypes[0]);
        } else {
            console.log('❌ Coupon notification type not found');
        }
        
        // Check user table structure (for user_id reference)
        console.log('\n📋 Table: user (sample structure)');
        const [userColumns] = await db.query('DESCRIBE user');
        userColumns.slice(0, 5).forEach(col => {
            console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
        });
        
        // Test sample data
        console.log('\n📊 Sample data check...');
        
        // Check existing coupons
        const [existingCoupons] = await db.query('SELECT COUNT(*) as count FROM couponcode');
        console.log(`📦 Total coupons: ${existingCoupons[0].count}`);
        
        // Check user count
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM user');
        console.log(`👥 Total users: ${userCount[0].count}`);
        
        await db.end();
        console.log('\n✅ Database check completed!');
        
    } catch (error) {
        console.error('❌ Error checking database:', error.message);
    }
}

checkDatabaseTables();
