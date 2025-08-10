const db = require("./config/database");

async function testOrderReturn() {
  try {
    console.log("🔍 Testing order return functionality...");
    
    // 1. Kiểm tra đơn hàng SN68822281
    const orderHash = "SN68822281";
    const [[order]] = await db.query(
      `SELECT o.order_id, o.user_id, o.current_status, o.created_at, o.order_hash,
       u.user_name, u.user_gmail as user_email
       FROM orders o
       LEFT JOIN user u ON o.user_id = u.user_id
       WHERE o.order_hash = ?`,
      [orderHash]
    );

    if (!order) {
      console.log("❌ Không tìm thấy đơn hàng", orderHash);
      return;
    }

    console.log("📦 Order found:", {
      order_id: order.order_id,
      order_hash: order.order_hash,
      current_status: order.current_status,
      user_id: order.user_id,
      user_name: order.user_name
    });

    // 2. Kiểm tra items trong đơn hàng
    const [orderItems] = await db.query(
      `SELECT oi.order_item_id, oi.variant_id, oi.quantity, oi.product_price, 
       vp.product_id, p.product_name, p.product_image
       FROM order_items oi
       LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
       LEFT JOIN product p ON vp.product_id = p.product_id
       WHERE oi.order_id = ?`,
      [order.order_id]
    );

    console.log(`📋 Order items (${orderItems.length}):`);
    orderItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.product_name} - Qty: ${item.quantity} - Price: ${item.product_price}`);
    });

    // 3. Kiểm tra bảng order_returns có tồn tại
    try {
      const [tables] = await db.query("SHOW TABLES LIKE 'order_returns'");
      console.log("📄 Table order_returns exists:", tables.length > 0);
      
      if (tables.length > 0) {
        const [columns] = await db.query("SHOW COLUMNS FROM order_returns");
        console.log("📄 Columns in order_returns:");
        columns.forEach(col => {
          console.log(`  - ${col.Field} (${col.Type})`);
        });
      }
    } catch (error) {
      console.log("❌ Error checking order_returns table:", error.message);
    }

    // 4. Kiểm tra bảng return_items có tồn tại
    try {
      const [tables2] = await db.query("SHOW TABLES LIKE 'return_items'");
      console.log("📄 Table return_items exists:", tables2.length > 0);
    } catch (error) {
      console.log("❌ Error checking return_items table:", error.message);
    }

    console.log("\n✅ Order return test completed!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

testOrderReturn();
