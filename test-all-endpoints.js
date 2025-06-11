const http = require('http');

// List of all endpoints to test
const endpoints = [
  { path: '/api/categories', name: 'Categories' },
  { path: '/api/products', name: 'Products' },
  { path: '/api/variants', name: 'Variants' },
  { path: '/api/rooms', name: 'Rooms' },
  { path: '/api/news', name: 'News' },
  { path: '/api/news-categories', name: 'News Categories' },
  { path: '/api/comments', name: 'Comments' }
];

const options = {
  hostname: 'localhost',
  port: 3501,
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

// Function to test a single endpoint
function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const requestOptions = { ...options, path: endpoint.path };
    
    console.log(`\n----- Testing ${endpoint.name} API -----`);
    console.log(`Connecting to http://${options.hostname}:${options.port}${endpoint.path}`);
    
    const req = http.request(requestOptions, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.log('API returned an error:', parsed.error || 'Unknown error');
            resolve({ endpoint: endpoint.name, success: false, message: parsed.error || 'Unknown error' });
            return;
          }
          
          if (Array.isArray(parsed)) {
            console.log(`✅ SUCCESS: Retrieved ${parsed.length} items`);
            if (parsed.length > 0) {
              console.log('First item sample:', JSON.stringify(parsed[0], null, 2));
            }
            resolve({ endpoint: endpoint.name, success: true, count: parsed.length });
          } else if (parsed.pagination && Array.isArray(parsed.data)) {
            console.log(`✅ SUCCESS: Retrieved ${parsed.data.length} items (paginated)`);
            if (parsed.data.length > 0) {
              console.log('First item sample:', JSON.stringify(parsed.data[0], null, 2));
            }
            resolve({ endpoint: endpoint.name, success: true, count: parsed.data.length });
          } else {
            console.log('✅ SUCCESS: Retrieved data in unexpected format');
            console.log('Response sample:', JSON.stringify(parsed, null, 2));
            resolve({ endpoint: endpoint.name, success: true, format: 'unexpected' });
          }
        } catch (e) {
          console.log('❌ ERROR: Failed to parse response as JSON');
          console.log('Raw response:', data.substring(0, 100) + '...');
          resolve({ endpoint: endpoint.name, success: false, message: 'Failed to parse JSON' });
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`❌ ERROR: Connection failed: ${e.message}`);
      resolve({ endpoint: endpoint.name, success: false, message: e.message });
    });
    
    req.end();
  });
}

// Test all endpoints sequentially
async function testAllEndpoints() {
  const results = [];
  
  console.log('==========================================');
  console.log('TESTING ALL API ENDPOINTS');
  console.log('==========================================');
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
  }
  
  console.log('\n==========================================');
  console.log('SUMMARY OF RESULTS');
  console.log('==========================================');
  
  let successCount = 0;
  let failureCount = 0;
  
  results.forEach(result => {
    if (result.success) {
      successCount++;
      console.log(`✅ ${result.endpoint}: SUCCESS`);
    } else {
      failureCount++;
      console.log(`❌ ${result.endpoint}: FAILED - ${result.message}`);
    }
  });
  
  console.log('\n==========================================');
  console.log(`FINAL RESULT: ${successCount}/${results.length} endpoints working`);
  if (successCount === results.length) {
    console.log('🎉 ALL ENDPOINTS ARE WORKING CORRECTLY!');
  } else {
    console.log(`⚠️ ${failureCount} ENDPOINTS FAILED`);
  }
  console.log('==========================================');
}

// Run the tests
testAllEndpoints().catch(err => {
  console.error('Test runner error:', err);
}); 