const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testOrderReturnWithToken() {
    console.log('🚀 Testing Order Return API with provided token...');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NDg0NzU5NCwiZXhwIjoxNzU0OTMzOTk0fQ.RVzmulByZ6DHE0FL5anoCDqwphqJbGgJOKS2KabbS0U';
    
    // Create FormData for the request
    const formData = new FormData();
    formData.append('reason', 'Sản phẩm bị lỗi, cần trả hàng để kiểm tra');
    formData.append('return_type', 'REFUND');
    
    // Create a test image buffer (1x1 PNG)
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    formData.append('return_images', testImageBuffer, {
        filename: 'test-return-image.png',
        contentType: 'image/png'
    });
    
    try {
        console.log('📤 Making POST request to order return endpoint...');
        console.log('🔑 Using token:', token.substring(0, 50) + '...');
        
        const response = await fetch('http://localhost:3501/api/orders/return/SN68822281', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                ...formData.getHeaders()
            },
            body: formData
        });
        
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response status text: ${response.statusText}`);
        
        const responseText = await response.text();
        console.log(`📄 Response body: ${responseText}`);
        
        if (response.ok) {
            try {
                const result = JSON.parse(responseText);
                console.log('✅ Order return success:', JSON.stringify(result, null, 2));
            } catch (e) {
                console.log('✅ Order return success (non-JSON response):', responseText);
            }
        } else {
            console.error(`❌ API Error (${response.status}): ${responseText}`);
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
        console.error('❌ Error details:', error);
    }
}

// Also test if server is running
async function checkServer() {
    try {
        console.log('🔍 Checking if server is running...');
        const response = await fetch('http://localhost:3501/');
        console.log(`✅ Server is running (status: ${response.status})`);
        return true;
    } catch (error) {
        console.error('❌ Server is not running:', error.message);
        return false;
    }
}

async function main() {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await testOrderReturnWithToken();
    } else {
        console.log('Please start the server first: node bin/www');
    }
}

main();
