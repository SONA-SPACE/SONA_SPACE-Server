const fetch = require('node-fetch');

async function testReturnApprovalWithEmail() {
    console.log('🚀 Testing return approval with email for order SN53858194...');
    
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
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Return status updated successfully!');
            console.log('📧 Email should have been sent to: hongthai2007.hongthai2007@gmail.com');
            console.log('Response:', result);
        } else {
            const errorText = await response.text();
            console.error(`❌ API Error (${response.status}): ${errorText}`);
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

testReturnApprovalWithEmail();
