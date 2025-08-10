const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const path = require('path');

async function testOrderReturnWithImages() {
  try {
    console.log('🚀 Testing Order Return API with Images...');
    
    // Chuẩn bị form data
    const form = new FormData();
    
    // Thêm lý do trả hàng
    form.append('reason', 'Sản phẩm bị lỗi, không đúng như mô tả. Yêu cầu hoàn tiền.');
    form.append('return_type', 'REFUND');
    
    // Tạo file ảnh giả để test (nếu không có ảnh thật)
    const testImagePath = path.join(__dirname, 'test-return-image.jpg');
    
    // Tạo file ảnh giả nếu chưa có
    if (!fs.existsSync(testImagePath)) {
      // Tạo buffer ảnh giả (1x1 pixel JPEG)
      const fakeImageBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
        0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
        0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
        0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
        0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x0c,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00, 0xaa, 0xff, 0xd9
      ]);
      fs.writeFileSync(testImagePath, fakeImageBuffer);
      console.log('✅ Created test image file');
    }
    
    // Thêm file ảnh vào form
    form.append('return_images', fs.createReadStream(testImagePath), {
      filename: 'return-image-1.jpg',
      contentType: 'image/jpeg'
    });
    
    // Thêm ảnh thứ 2 (copy của ảnh đầu)
    form.append('return_images', fs.createReadStream(testImagePath), {
      filename: 'return-image-2.jpg', 
      contentType: 'image/jpeg'
    });
    
    // Lấy token (bạn cần thay đổi token này)
    const token = 'YOUR_TEST_TOKEN_HERE'; // Thay bằng token thật
    const orderHash = 'SN68822281'; // Thay bằng order hash thật
    
    console.log(`📤 Sending return request for order: ${orderHash}`);
    console.log('📋 Reason:', 'Sản phẩm bị lỗi, không đúng như mô tả. Yêu cầu hoàn tiền.');
    console.log('🖼️ Images:', '2 files');
    
    // Gửi request
    const response = await axios.post(
      `http://localhost:3501/api/orders/return/${orderHash}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000 // 30 seconds timeout
      }
    );
    
    console.log('✅ Response Status:', response.status);
    console.log('📝 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('🎉 Order return with images submitted successfully!');
      console.log('🆔 Return ID:', response.data.data.return_id);
      console.log('🖼️ Uploaded Images:', response.data.data.return_images.length);
      console.log('💰 Total Refund:', response.data.data.total_refund);
      
      if (response.data.data.return_images.length > 0) {
        console.log('\n📸 Uploaded Image URLs:');
        response.data.data.return_images.forEach((url, index) => {
          console.log(`   ${index + 1}. ${url}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing order return API:', error.message);
    
    if (error.response) {
      console.error('📊 Response Status:', error.response.status);
      console.error('📄 Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Server is not running. Please start the server first.');
    }
  }
}

// Chạy test
testOrderReturnWithImages();
