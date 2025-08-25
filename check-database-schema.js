// Database schema checker
const db = require('./config/database');

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // List all tables
    const [tables] = await db.query('SHOW TABLES');
    console.log('\n📋 Available tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    
    // Find order-related tables
    const orderTables = tables.filter(table => {
      const tableName = Object.values(table)[0].toLowerCase();
      return tableName.includes('order');
    });
    
    if (orderTables.length > 0) {
      console.log('\n📦 Order-related tables:');
      for (const table of orderTables) {
        const tableName = Object.values(table)[0];
        console.log(`\n  📊 Table: ${tableName}`);
        
        try {
          const [columns] = await db.query(`DESCRIBE ${tableName}`);
          columns.forEach(col => {
            console.log(`    - ${col.Field} (${col.Type})`);
          });
          
          // Get sample data count
          const [count] = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`    📈 Records: ${count[0].count}`);
          
        } catch (error) {
          console.log(`    ❌ Error describing table: ${error.message}`);
        }
      }
    }
    
    // Check for order ID 467 in each order table
    console.log('\n🔎 Searching for order ID 467...');
    for (const table of orderTables) {
      const tableName = Object.values(table)[0];
      try {
        const [result] = await db.query(`SELECT * FROM ${tableName} WHERE order_id = 467 OR id = 467 LIMIT 1`);
        if (result.length > 0) {
          console.log(`  ✅ Found order 467 in table: ${tableName}`);
          console.log(`     Data:`, result[0]);
        }
      } catch (error) {
        console.log(`  ⚠ Could not search in ${tableName}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Schema check failed:', error.message);
  } finally {
    process.exit(0);
  }
}

checkDatabaseSchema();
