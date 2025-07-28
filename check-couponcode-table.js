const db = require('./config/database');

async function checkCouponcodeTable() {
  try {
    console.log('Checking couponcode table structure...');
    
    const [columns] = await db.query('DESCRIBE couponcode');
    console.log('\nColumns in couponcode table:');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type}, ${col.Null}, ${col.Key}, ${col.Default})`);
    });

    console.log('\nSample data from couponcode table:');
    const [rows] = await db.query('SELECT * FROM couponcode LIMIT 3');
    console.log(rows);

  } catch (error) {
    console.error('Error checking table:', error.message);
  } finally {
    process.exit(0);
  }
}

checkCouponcodeTable();
