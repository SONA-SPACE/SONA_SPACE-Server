const fetch = require('node-fetch');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'fur.timefortea.io.vn',
    user: process.env.DB_USERNAME || 'thainguyen0802', 
    password: process.env.DB_PASSWORD || 'Cegatcn!080297',
    database: process.env.DB_DATABASE || 'furnitown'
};

async function testReturnCouponCreation() {
    console.log('🎁 Testing return coupon creation for order SN53858194...');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NDg0NzU5NCwiZXhwIjoxNzU0OTMzOTk0fQ.RVzmulByZ6DHE0FL5anoCDqwphqJbGgJOKS2KabbS0U';
    const orderId = 318; // Order SN53858194
    
    try {
        // Connect to database to check before state
        const db = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected');
        
        // Check existing coupons for this user
        const [beforeCoupons] = await db.query(`
            SELECT c.code, c.title, c.value_price, c.exp_time, c.created_at
            FROM couponcode c
            JOIN user_has_coupon uhc ON c.couponcode_id = uhc.couponcode_id
            WHERE uhc.user_id = 61 AND c.code LIKE 'RETURN20_%'
            ORDER BY c.created_at DESC
        `);
        
        console.log(`📊 User has ${beforeCoupons.length} return coupons before test`);
        if (beforeCoupons.length > 0) {
            console.log('Latest return coupon:', beforeCoupons[0].code);
        }
        
        await db.end();
        
        // Now test the API
        console.log('🔄 Updating return status to APPROVED...');
        
        const response = await fetch(`http://localhost:3501/api/orders/${orderId}/return-status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                return_status: 'APPROVED'
            })
        });
        
        console.log(`📊 Response status: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Return status updated successfully!');
            console.log('Response:', result);
            
            // Check if coupon was created
            await checkCouponCreation();
            
        } else {
            const errorText = await response.text();
            console.error(`❌ API Error (${response.status}): ${errorText}`);
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

async function checkCouponCreation() {
    console.log('\n🔍 Checking if return coupon was created...');
    
    try {
        const db = await mysql.createConnection(dbConfig);
        
        // Check new coupons for the user
        const [afterCoupons] = await db.query(`
            SELECT c.code, c.title, c.value_price, c.discount_type, c.exp_time, c.min_order, c.created_at
            FROM couponcode c
            JOIN user_has_coupon uhc ON c.couponcode_id = uhc.couponcode_id
            WHERE uhc.user_id = 61 AND c.code LIKE 'RETURN20_%'
            ORDER BY c.created_at DESC
            LIMIT 1
        `);
        
        if (afterCoupons.length > 0) {
            const coupon = afterCoupons[0];
            console.log('🎁 Return coupon created successfully!');
            console.log('Coupon details:', {
                code: coupon.code,
                title: coupon.title,
                discount: `${coupon.value_price}%`,
                type: coupon.discount_type,
                min_order: coupon.min_order,
                expires: new Date(coupon.exp_time).toLocaleDateString('vi-VN'),
                created: new Date(coupon.created_at).toLocaleString('vi-VN')
            });
            
            // Check notification
            const [notifications] = await db.query(`
                SELECT n.title, n.message, n.created_at
                FROM notifications n
                JOIN user_notifications un ON n.id = un.notification_id
                WHERE un.user_id = 61 AND n.title LIKE '%mã giảm giá trả hàng%'
                ORDER BY n.created_at DESC
                LIMIT 1
            `);
            
            if (notifications.length > 0) {
                console.log('📧 Notification created:', notifications[0].title);
            }
            
        } else {
            console.log('❌ No return coupon found for user');
        }
        
        await db.end();
        
    } catch (error) {
        console.error('❌ Error checking coupon:', error.message);
    }
}

testReturnCouponCreation();
