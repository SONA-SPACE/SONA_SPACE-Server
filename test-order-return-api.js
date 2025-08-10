const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testOrderReturnAPI() {
    console.log('🚀 Testing Order Return API...');
    
    // Get admin token first
    const tokenResponse = await fetch('http://localhost:3501/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'admin@sona.com',
            password: 'admin123'
        })
    });
    
    if (!tokenResponse.ok) {
        console.error('❌ Failed to get admin token');
        return;
    }
    
    const tokenData = await tokenResponse.json();
    console.log('✅ Got admin token');
    
    // Create FormData for the request
    const formData = new FormData();
    formData.append('reason', 'Sản phẩm bị lỗi, cần trả hàng');
    formData.append('returnType', 'REFUND');
    formData.append('totalRefund', '24000000');
    
    // Create a test image file in memory
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    formData.append('returnImages', testImageBuffer, {
        filename: 'test-image.png',
        contentType: 'image/png'
    });
    
    try {
        console.log('📤 Making POST request to order return endpoint...');
        
        const response = await fetch('http://localhost:3501/api/orders/return/SN68822281', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenData.token}`,
                ...formData.getHeaders()
            },
            body: formData
        });
        
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response headers:`, response.headers.raw());
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error (${response.status}):`, errorText);
            return;
        }
        
        const result = await response.json();
        console.log('✅ Order return success:', result);
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

// Also test with curl command generation
function generateCurlCommand() {
    console.log('\n🔧 Alternative: Use this curl command to test:');
    console.log(`
curl -X POST "http://localhost:3501/api/orders/return/SN68822281" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -F "reason=Sản phẩm bị lỗi" \\
  -F "returnType=REFUND" \\
  -F "totalRefund=24000000" \\
  -F "returnImages=@test-image.png"
    `);
}

testOrderReturnAPI().then(() => {
    generateCurlCommand();
    process.exit(0);
}).catch(console.error);
