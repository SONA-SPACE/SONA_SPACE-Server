const db = require('./config/database');

async function testCategoryTable() {
  try {
    console.log("Testing category table...");
    
    // Check category table structure
    console.log("\nChecking category table structure:");
    try {
      const [columns] = await db.query('DESCRIBE category');
      console.log(columns);
    } catch (error) {
      console.error("Error describing category table:", error.message);
    }
    
    // Try to fetch data from category table
    console.log("\nTrying to fetch data from category table:");
    try {
      const [categories] = await db.query('SELECT * FROM category LIMIT 5');
      console.log(`Found ${categories.length} categories`);
      if (categories.length > 0) {
        console.log("Sample category:", categories[0]);
      }
    } catch (error) {
      console.error("Error fetching from category table:", error.message);
    }
    
    console.log("\nCategory table test complete");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Close the connection pool
    await db.end();
  }
}

testCategoryTable(); 