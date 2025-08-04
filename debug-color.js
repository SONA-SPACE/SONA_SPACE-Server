const db = require("./config/database");

async function debugColorInfo() {
  try {
    console.log("🔍 Debugging color information for order 354...");
    
    // 1. Check order items first
    const [orderItems] = await db.query(
      `SELECT oi.*, oi.variant_id FROM order_items oi WHERE oi.order_id = 354`
    );
    console.log("📦 Order items:", orderItems);
    
    if (orderItems.length > 0) {
      const variantId = orderItems[0].variant_id;
      console.log(`\n🔍 Checking variant ${variantId}...`);
      
      // 2. Check variant_product table
      const [variants] = await db.query(
        `SELECT * FROM variant_product WHERE variant_id = ?`, 
        [variantId]
      );
      console.log("🎨 Variant info:", variants[0]);
      
      // 3. Check if color_id exists and get color info
      if (variants[0] && variants[0].color_id) {
        const [colors] = await db.query(
          `SELECT * FROM color WHERE color_id = ?`, 
          [variants[0].color_id]
        );
        console.log("🌈 Color info:", colors[0]);
      } else {
        console.log("❌ No color_id found in variant_product");
      }
      
      // 4. Test the full JOIN query
      console.log("\n🔗 Testing full JOIN query...");
      const [fullJoin] = await db.query(`
        SELECT 
          oi.*,
          vp.color_id as variant_color_id,
          c.color_name,
          c.color_hex,
          p.product_name
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        LEFT JOIN color c ON vp.color_id = c.color_id
        WHERE oi.order_id = 354
      `);
      console.log("🔗 Full JOIN result:", fullJoin[0]);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

debugColorInfo();
