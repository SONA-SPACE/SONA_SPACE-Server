const http = require('http');

// Replace this with the token you received from the login request
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTc0ODA5MDAzNywiZXhwIjoxNzQ4MTc2NDM3fQ.Gh0xefeSOdHYvs2TD5MZDNUKbRSxn4LHn7VYNnyaNkI';

// The endpoint to test - you can change this to any protected endpoint
const endpoint = '/api/comments';

// Make a request to the protected endpoint
const options = {
  hostname: 'localhost',
  port: 3501,
  path: endpoint,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Accept': 'application/json'
  }
};

console.log(`Attempting to access protected endpoint: http://${options.hostname}:${options.port}${options.path}`);
console.log(`Using authorization token: ${authToken.substring(0, 20)}...`);

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response completed');
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.log('API returned an error:', parsed.error);
      } else {
        console.log('Access successful!');
        console.log('Response data preview:');
        console.log(JSON.stringify(parsed, null, 2).substring(0, 500) + '...');
      }
    } catch (e) {
      console.log('Failed to parse response as JSON');
      console.log('Raw response:', data.substring(0, 500) + '...');
    }
  });
});

req.on('error', (e) => {
  console.error(`Connection test failed: ${e.message}`);
});

req.end(); 