const db = require("./config/database");

async function testCategoriesAPI() {
  try {
    console.log("🔍 Testing categories API...");
    
    // Test the SQL query used in the API
    const sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
      FROM category c WHERE category_status = 1
      ORDER BY c.category_priority ASC
    `;
    
    const [categories] = await db.query(sql);
    console.log(`📂 Found ${categories.length} categories:`);
    
    categories.forEach((category, index) => {
      console.log(`  ${index + 1}. ID: ${category.category_id}, Name: "${category.category_name}", Products: ${category.product_count}`);
    });
    
    console.log("\n✅ Categories API data structure:");
    console.log("Response format: Array of categories");
    console.log("Each category has:", Object.keys(categories[0] || {}));
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

testCategoriesAPI();
