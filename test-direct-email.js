const { sendEmail1 } = require('./services/mailService1');

async function testReturnApprovedEmail() {
    console.log('📧 Testing return approved email template...');
    
    const emailData = {
        customerName: 'Nguyễn Hồng Thái',
        orderHash: 'SN53858194',
        reason: 'Sản phẩm bị lỗi, cần trả hàng để kiểm tra',
        refundAmount: 24000000,
        approvalDate: new Date().toLocaleDateString('vi-VN'),
        supportEmail: 'sonaspace.furniture@gmail.com',
        supportPhone: '1900-1234'
    };
    
    try {
        console.log('📤 Sending email...');
        const result = await sendEmail1(
            'hongthai2007.hongthai2007@gmail.com',
            '[Sona Space] Đã duyệt yêu cầu trả hàng - SN53858194',
            emailData,
            'return-approved'
        );
        
        if (result) {
            console.log('✅ Email sent successfully!');
        } else {
            console.log('❌ Email sending failed');
        }
        
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
    }
}

testReturnApprovedEmail();
