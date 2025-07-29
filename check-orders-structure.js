const db = require('./config/database');

async function checkOrdersStructure() {
  try {
    console.log("=== KIỂM TRA CẤU TRÚC BẢNG ORDERS ===");
    
    // Lấy cấu trúc bảng orders
    const [structure] = await db.query("DESCRIBE orders");
    console.log("Cấu trúc bảng orders:");
    console.table(structure);
    
    // Lấy thử 1 đơn hàng để xem dữ liệu
    const [sampleOrder] = await db.query("SELECT * FROM orders WHERE order_id = 2 LIMIT 1");
    console.log("\nDữ liệu đơn hàng ID 2:");
    console.log(JSON.stringify(sampleOrder[0], null, 2));
    
  } catch (error) {
    console.error('Lỗi:', error.message);
  } finally {
    process.exit(0);
  }
}

checkOrdersStructure();
