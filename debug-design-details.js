const fetch = require('node-fetch');

async function debugDesignDetails() {
  try {
    console.log('🔍 Testing debug design details API...');
    
    // Test debug API endpoint (no auth needed)
    const response = await fetch('http://localhost:3501/api/contact-form-design/43/details/debug');
    
    const data = await response.json();
    console.log('📊 Debug API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.data && data.data.length > 0) {
      console.log('\n🔑 Available fields in first item:');
      console.log(Object.keys(data.data[0]));
      
      console.log('\n🆔 Checking ID fields:');
      const firstItem = data.data[0];
      const idFields = Object.keys(firstItem).filter(key => 
        key.toLowerCase().includes('id') || 
        key.toLowerCase().includes('detail')
      );
      console.log('ID-related fields:', idFields);
      
      idFields.forEach(field => {
        console.log(`  ${field}: ${firstItem[field]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDesignDetails();
