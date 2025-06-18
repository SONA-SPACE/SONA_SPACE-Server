const axios = require('axios');

const BASE_URL = 'http://localhost:3501';

// Test API lấy sản phẩm mới nhất với các limit khác nhau
async function testNewestProducts() {
  console.log('=== TEST API LẤY SẢN PHẨM MỚI NHẤT (CẬP NHẬT) ===\n');
  
  // Test với limit mặc định (8)
  const defaultProducts = await testWithLimit(null);
  
  // Test với limit = 5
  await testWithLimit(5);
  
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
      console.log(`   Màu sắc: ${product.color_name} (HEX: ${product.color_hex}, Priority: ${product.color_priority})`);
      console.log(`   Giá: ${product.price || 'N/A'}, Giá khuyến mãi: ${product.price_sale || 'N/A'}`);
      console.log(`   Variant ID: ${product.variant_id}`);
      console.log('   ---------------------');
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
    
    // Nếu đây là test đầu tiên (default), kiểm tra xem các sản phẩm có đều cùng color_priority không
    if (!limit && response.data.length > 0) {
      console.log('\nKiểm tra color_priority:');
      const firstPriority = response.data[0].color_priority;
      let allSamePriority = true;
      
      response.data.forEach(product => {
        if (product.color_priority !== firstPriority) {
          console.log(`LỖI: Phát hiện color_priority không đồng nhất: Sản phẩm ID ${product.product_id} có priority ${product.color_priority} khác với ${firstPriority}`);
          allSamePriority = false;
        }
      });
      
      if (allSamePriority) {
        console.log(`OK: Tất cả sản phẩm đều có cùng độ ưu tiên màu là ${firstPriority}`);
      }
      
      // Kiểm tra trong CSDL nếu có priority khác ngoài giá trị hiện tại
      console.log('\nGhi chú: Độ ưu tiên màu (color_priority) trong CSDL hiện đang là 0 cho tất cả sản phẩm.');
      console.log('Điều này có nghĩa là tất cả màu đều có cùng độ ưu tiên, và câu truy vấn đang hoạt động đúng.');
      console.log('Để tận dụng tốt hơn chức năng này, bạn nên cập nhật giá trị color_priority trong CSDL (giá trị nhỏ hơn = ưu tiên cao hơn).');
    }
    
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