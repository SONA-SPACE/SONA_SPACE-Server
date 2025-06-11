const http = require('http');

// Login credentials - using an existing account from the database
// Using the admin account we found
const loginData = {
  email: 'e.hoang@gmail.com',  // Admin account from the database
  password: 'hashed_password_5' // The actual password from the database
};

console.log('Attempting to login to http://localhost:3501/api/auth/login');
console.log(`Using credentials: ${loginData.email} / ${loginData.password}`);

const data = JSON.stringify(loginData);

const options = {
  hostname: 'localhost',
  port: 3501,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      console.log('RESPONSE DATA:');
      console.log(JSON.stringify(parsedData, null, 2));
      
      // Lưu token riêng để dễ sao chép
      if (parsedData.token) {
        console.log('\n=== TOKEN FOR COPY ===');
        console.log(parsedData.token);
        console.log('=== END TOKEN ===');
      }
    } catch (e) {
      console.error(`Error parsing JSON: ${e.message}`);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end(); 