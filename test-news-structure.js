const db = require('./config/database');

async function testNewsTable() {
  try {
    console.log("Testing news table structure...");
    
    // Check table structure
    console.log("\nChecking news table structure:");
    try {
      const [columns] = await db.query('DESCRIBE news');
      console.log("Columns:");
      columns.forEach(col => {
        console.log(`- ${col.Field} (${col.Type}), Key: ${col.Key}, Default: ${col.Default}`);
      });
    } catch (error) {
      console.error("Error describing news table:", error.message);
    }
    
    // Try to fetch data
    console.log("\nFetching sample data from news table:");
    try {
      const [news] = await db.query('SELECT * FROM news LIMIT 2');
      console.log(`Found ${news.length} news articles`);
      if (news.length > 0) {
        console.log("Sample news article:");
        console.log(news[0]);
      }
    } catch (error) {
      console.error("Error fetching from news table:", error.message);
    }
    
    // Also check the news_categories table
    console.log("\nChecking news_categories table structure:");
    try {
      const [columns] = await db.query('DESCRIBE news_categories');
      console.log("Columns:");
      columns.forEach(col => {
        console.log(`- ${col.Field} (${col.Type}), Key: ${col.Key}, Default: ${col.Default}`);
      });
    } catch (error) {
      console.error("Error describing news_categories table:", error.message);
    }
    
    console.log("\nNews table test complete");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Close the connection pool
    await db.end();
  }
}

testNewsTable(); 