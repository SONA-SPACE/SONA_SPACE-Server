const db = require("./config/database");

async function testBannerStructure() {
  try {
    console.log("🔍 Testing banner and category structure...");
    
    // 1. Test categories
    const [categories] = await db.query("SELECT category_id, category_name FROM category LIMIT 5");
    console.log("📂 Categories available:", categories);
    
    // 2. Test banners with category join
    const [banners] = await db.query(`
      SELECT 
        b.banner_id,
        b.title,
        b.image_url,
        b.position,
        b.is_active,
        b.page_type,
        b.category_id,
        b.start_date,
        b.end_date,
        c.category_name
      FROM banners b
      LEFT JOIN category c ON b.category_id = c.category_id
      ORDER BY b.created_at DESC
      LIMIT 3
    `);
    console.log("🎯 Banners with categories:", banners);
    
    console.log("✅ Banner structure is ready!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

testBannerStructure();
