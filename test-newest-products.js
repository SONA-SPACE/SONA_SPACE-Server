const axios = require('axios');

const BASE_URL = 'http://localhost:3501';

// Test API lấy sản phẩm mới nhất với các limit khác nhau
async function testNewestProducts() {
  console.log('=== TEST API LẤY SẢN PHẨM MỚI NHẤT ===\n');
  
  // Test với limit mặc định (8)
  await testWithLimit(null);
  
  // Test với limit = 5
  await testWithLimit(5);
  
  // Test với limit = 12
  await testWithLimit(12);
  
  console.log('\n=== KẾT THÚC TEST API ===');
}

// Hàm test với limit cụ thể
async function testWithLimit(limit) {
  try {
    const url = limit 
      ? `${BASE_URL}/api/products/newest?limit=${limit}` 
      : `${BASE_URL}/api/products/newest`;
    
    console.log(`Gửi request đến: ${url}`);
    
    const response = await axios.get(url);
    
    console.log(`Kết quả (${response.data.length} sản phẩm):`);
    
    // Hiển thị thông tin tóm tắt về mỗi sản phẩm
    response.data.forEach((product, index) => {
      console.log(`${index + 1}. ID: ${product.product_id}, Tên: ${product.product_name}, Ngày tạo: ${new Date(product.created_at).toLocaleString()}`);
    });
    
    console.log('\nSắp xếp theo ngày tạo (mới nhất đầu tiên):');
    // Kiểm tra xem sản phẩm có được sắp xếp theo thứ tự ngày tạo giảm dần không
    let isOrderedByDate = true;
    for (let i = 1; i < response.data.length; i++) {
      const currentDate = new Date(response.data[i].created_at);
      const prevDate = new Date(response.data[i-1].created_at);
      
      if (currentDate > prevDate) {
        isOrderedByDate = false;
        break;
      }
    }
    
    console.log(isOrderedByDate 
      ? 'OK: Sản phẩm được sắp xếp đúng theo ngày tạo (mới nhất đầu tiên)'
      : 'LỖI: Sản phẩm không được sắp xếp theo ngày tạo');
    
    console.log('---------------------------------------------');
    
    return response.data;
  } catch (error) {
    console.log('Lỗi khi gọi API:');
    if (error.response) {
      console.log('- Mã trạng thái:', error.response.status);
      console.log('- Lỗi:', error.response.data);
    } else {
      console.log('- Lỗi:', error.message);
    }
    
    console.log('---------------------------------------------');
    return null;
  }
}

// Chạy test
testNewestProducts(); 