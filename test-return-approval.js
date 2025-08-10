const fetch = require('node-fetch');

async function testReturnApprovalEmail() {
    console.log('🚀 Testing return approval email for order SN53858194...');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NDg0NzU5NCwiZXhwIjoxNzU0OTMzOTk0fQ.RVzmulByZ6DHE0FL5anoCDqwphqJbGgJOKS2KabbS0U';
    const orderId = 318; // Order SN53858194
    
    try {
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
        console.log(`📊 Response status text: ${response.statusText}`);
        
        const responseText = await response.text();
        console.log(`📄 Response body: ${responseText}`);
        
        if (response.ok) {
            try {
                const result = JSON.parse(responseText);
                console.log('✅ Return status updated successfully:', result);
                console.log('📧 Email should have been sent to: hongthai2007.hongthai2007@gmail.com');
            } catch (e) {
                console.log('✅ Return status updated (non-JSON response):', responseText);
            }
        } else {
            console.error(`❌ API Error (${response.status}): ${responseText}`);
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

// Also test basic email functionality
async function testBasicEmail() {
    console.log('\n📧 Testing basic email functionality...');
    
    try {
        const response = await fetch('http://localhost:3501/api/orders/test-email');
        console.log(`📊 Email test response: ${response.status}`);
        
        if (response.ok) {
            const result = await response.text();
            console.log('✅ Basic email test result:', result);
        } else {
            const errorText = await response.text();
            console.log('❌ Basic email test failed:', errorText);
        }
    } catch (error) {
        console.log('❌ Basic email test error:', error.message);
    }
}

async function main() {
    await testBasicEmail();
    await testReturnApprovalEmail();
}

main();
