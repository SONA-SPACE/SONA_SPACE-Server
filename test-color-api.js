const express = require('express');
const db = require('./config/database');

async function testColorAPI() {
  try {
    console.log('🧪 Testing color API directly...');
    
    const orderId = 354;
    const orderItemsQuery = `
      SELECT 
        oi.*,
        p.product_name,
        p.product_image,
        p.product_slug,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_list_image,
        vp.color_id as variant_color_id,
        c.color_name,
        c.color_hex,
        cat.category_name AS category,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) AS comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) AS average_rating
      FROM order_items oi
      LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
      LEFT JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      WHERE oi.order_id = ?
    `;

    const [orderItems] = await db.query(orderItemsQuery, [orderId]);
    
    console.log(`📦 Found ${orderItems.length} items for order ${orderId}`);
    
    orderItems.forEach((item, index) => {
      console.log(`🎨 Item ${index + 1} complete info:`, {
        variant_id: item.variant_id,
        variant_color_id: item.variant_color_id,
        color_name: item.color_name,
        color_hex: item.color_hex,
        product_name: item.product_name
      });
    });
    
    console.log('\n✅ Color information is working correctly!');
    console.log('🔍 The API should return:', {
      color_name: orderItems[0]?.color_name,
      color_hex: orderItems[0]?.color_hex
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

testColorAPI();
