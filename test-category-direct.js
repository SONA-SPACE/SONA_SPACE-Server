const db = require('./config/database');

async function testCategoryQuery() {
  try {
    console.log("Testing direct SQL query on category table...");
    
    // Test a simple query first
    console.log("\nTrying basic query:");
    try {
      const [result] = await db.query('SELECT * FROM category LIMIT 5');
      console.log(`Found ${result.length} categories with basic query`);
      if (result.length > 0) {
        console.log("First category:", result[0]);
      }
    } catch (error) {
      console.error("Error with basic query:", error.message);
    }
    
    // Now try the full query from the route
    console.log("\nTrying full query:");
    try {
      const sql = `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
        FROM category c
        ORDER BY c.category_name ASC
      `;
      
      const [result] = await db.query(sql);
      console.log(`Found ${result.length} categories with full query`);
      if (result.length > 0) {
        console.log("First category:", result[0]);
      }
    } catch (error) {
      console.error("Error with full query:", error.message);
    }
    
    console.log("\nDirect SQL test complete");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Close the connection pool
    await db.end();
  }
}

testCategoryQuery(); 