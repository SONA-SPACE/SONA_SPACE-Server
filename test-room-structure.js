const db = require('./config/database');

async function testRoomTable() {
  try {
    console.log("Testing room table structure...");
    
    // Check table structure
    console.log("\nChecking room table structure:");
    try {
      const [columns] = await db.query('DESCRIBE room');
      console.log("Columns:");
      columns.forEach(col => {
        console.log(`- ${col.Field} (${col.Type}), Key: ${col.Key}, Default: ${col.Default}`);
      });
    } catch (error) {
      console.error("Error describing room table:", error.message);
    }
    
    // Try to fetch data
    console.log("\nFetching sample data from room table:");
    try {
      const [rooms] = await db.query('SELECT * FROM room LIMIT 2');
      console.log(`Found ${rooms.length} rooms`);
      if (rooms.length > 0) {
        console.log("Sample room:");
        console.log(rooms[0]);
      }
    } catch (error) {
      console.error("Error fetching from room table:", error.message);
    }
    
    // Also check the room_product table
    console.log("\nChecking room_product table structure:");
    try {
      const [columns] = await db.query('DESCRIBE room_product');
      console.log("Columns:");
      columns.forEach(col => {
        console.log(`- ${col.Field} (${col.Type}), Key: ${col.Key}, Default: ${col.Default}`);
      });
    } catch (error) {
      console.error("Error describing room_product table:", error.message);
    }
    
    console.log("\nRoom table test complete");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Close the connection pool
    await db.end();
  }
}

testRoomTable(); 