async function fixPrices() {
  const connection = await mysql.createConnection({
    host: 'fur.timefortea.io.vn',
    user: 'root',
    password: 'TimeForTea@2024!',
    database: 'furnitown_db'
  });

  try {
    // Get all contact_form_design_details with suspicious prices (> 100 million)
    const [rows] = await connection.execute(`
      SELECT contact_form_design_id, variant_id, unit_price, total_price, quantity 
      FROM contact_form_design_details 
      WHERE unit_price > 100000000
    `);

    console.log(`Found ${rows.length} records with suspicious prices:`);
    
    for (const row of rows) {
      const newUnitPrice = Math.floor(row.unit_price / 100);
      const newTotalPrice = newUnitPrice * row.quantity;
      
      console.log(`Fixing: ${row.unit_price} -> ${newUnitPrice}`);
      
      await connection.execute(`
        UPDATE contact_form_design_details 
        SET unit_price = ?, total_price = ?, updated_at = NOW()
        WHERE contact_form_design_id = ? AND variant_id = ?
      `, [newUnitPrice, newTotalPrice, row.contact_form_design_id, row.variant_id]);
    }

    console.log('✅ Price fixing completed!');
  } catch (error) {
    console.error('❌ Error fixing prices:', error);
  } finally {
    await connection.end();
  }
}

fixPrices();
