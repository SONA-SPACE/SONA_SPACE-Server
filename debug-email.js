const { sendEmail1 } = require('./services/mailService1');

async function debugEmailIssue() {
    console.log('🔍 Debugging email issue...');
    
    // Check environment variables
    console.log('📧 Email configuration:');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'Not set');
    
    // Test simple email
    const testData = {
        customerName: 'Test Customer',
        orderHash: 'TEST123',
        reason: 'Test reason',
        refundAmount: 1000000,
        approvalDate: new Date().toLocaleDateString('vi-VN'),
        supportEmail: 'sonaspace.furniture@gmail.com',
        supportPhone: '1900-1234'
    };
    
    try {
        console.log('\n📤 Testing email send...');
        console.log('To:', 'hongthai2007.hongthai2007@gmail.com');
        console.log('Template:', 'return-approved');
        
        const result = await sendEmail1(
            'hongthai2007.hongthai2007@gmail.com',
            '[Test] Email functionality test',
            testData,
            'return-approved'
        );
        
        console.log('📊 Email result:', result);
        
        if (result) {
            console.log('✅ Email sent successfully!');
        } else {
            console.log('❌ Email sending failed');
        }
        
    } catch (error) {
        console.error('❌ Detailed error:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('Code:', error.code);
        console.error('Response:', error.response);
    }
}

// Also test template rendering separately
async function testTemplateRendering() {
    console.log('\n🎨 Testing template rendering...');
    const ejs = require('ejs');
    const path = require('path');
    
    try {
        const templatePath = path.join(__dirname, 'template/return-approved.ejs');
        console.log('Template path:', templatePath);
        
        // Check if template exists
        const fs = require('fs');
        if (fs.existsSync(templatePath)) {
            console.log('✅ Template file exists');
            
            const testData = {
                customerName: 'Test Customer',
                orderHash: 'TEST123',
                reason: 'Test reason',
                refundAmount: 1000000,
                approvalDate: new Date().toLocaleDateString('vi-VN'),
                supportEmail: 'sonaspace.furniture@gmail.com',
                supportPhone: '1900-1234'
            };
            
            const html = await ejs.renderFile(templatePath, testData);
            console.log('✅ Template rendered successfully');
            console.log('HTML length:', html.length);
        } else {
            console.log('❌ Template file not found');
        }
    } catch (error) {
        console.error('❌ Template rendering error:', error.message);
    }
}

async function main() {
    await testTemplateRendering();
    await debugEmailIssue();
}

main();
