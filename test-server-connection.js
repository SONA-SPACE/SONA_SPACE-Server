const http = require('http');

// Make a simple request to the root path
const options = {
  hostname: 'localhost',
  port: 3501,
  path: '/',
  method: 'GET'
};

console.log(`Attempting to connect to http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('BODY:', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
    console.log('Connection test completed successfully');
  });
});

req.on('error', (e) => {
  console.error(`Connection test failed: ${e.message}`);
  
  if (e.code === 'ECONNREFUSED') {
    console.log('\nThe server appears to be unreachable. Possible causes:');
    console.log('1. The server is not running');
    console.log('2. The server is running on a different port');
    console.log('3. The server is only listening on a specific IP address');
    console.log('\nCheck the server config in bin/www and verify HOST and port settings.');
  }
});

req.end(); 