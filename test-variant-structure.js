const db = require('./config/database');

async function testVariantTable() {
  try {
    console.log("Testing variant_product table structure...");
    
    // Check table structure
    console.log("\nChecking variant_product table structure:");
    try {
      const [columns] = await db.query('DESCRIBE variant_product');
      console.log("Columns:");
      columns.forEach(col => {
        console.log(`- ${col.Field} (${col.Type}), Key: ${col.Key}, Default: ${col.Default}`);
      });
    } catch (error) {
      console.error("Error describing variant_product table:", error.message);
    }
    
    // Try to fetch data
    console.log("\nFetching sample data from variant_product:");
    try {
      const [variants] = await db.query('SELECT * FROM variant_product LIMIT 2');
      console.log(`Found ${variants.length} variants`);
      if (variants.length > 0) {
        console.log("Sample variant:");
        console.log(variants[0]);
      }
    } catch (error) {
      console.error("Error fetching from variant_product table:", error.message);
    }
    
    console.log("\nVariant table test complete");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Close the connection pool
    await db.end();
  }
}

testVariantTable(); 