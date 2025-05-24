const http = require('http');

// Function to make a direct HTTP request to the categories endpoint
function testCategoriesEndpoint() {
  console.log('Testing categories endpoint...');
  
  // Options for the HTTP request
  const options = {
    hostname: 'localhost',
    port: 3500,
    path: '/api/categories',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };
  
  // Create and send the request
  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    
    // A chunk of data has been received.
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    // The whole response has been received.
    res.on('end', () => {
      console.log('Response completed');
      try {
        const parsedData = JSON.parse(data);
        console.log('Response body (parsed):');
        if (Array.isArray(parsedData)) {
          console.log(`Array with ${parsedData.length} items`);
          if (parsedData.length > 0) {
            console.log('First item:', parsedData[0]);
          }
        } else {
          console.log(parsedData);
        }
      } catch (e) {
        console.log('Response body (raw):', data);
        console.error('Error parsing response as JSON:', e.message);
      }
    });
  });
  
  // Handle request errors
  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });
  
  // End the request
  req.end();
}

// Test the health endpoint first to see if the server is responsive
function testHealthEndpoint() {
  console.log('Testing health endpoint...');
  
  const options = {
    hostname: 'localhost',
    port: 3500,
    path: '/health',
    method: 'GET'
  };
  
  const req = http.request(options, (res) => {
    console.log(`Health check STATUS: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Health check response:', data);
      
      // If health check is successful, test the categories endpoint
      if (res.statusCode === 200) {
        setTimeout(testCategoriesEndpoint, 500); // Add a small delay
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`Health check failed: ${e.message}`);
  });
  
  req.end();
}

// Start testing
testHealthEndpoint(); 