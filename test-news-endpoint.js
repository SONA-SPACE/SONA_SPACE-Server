const http = require('http');

// Make a request specifically to the news endpoint
const options = {
  hostname: 'localhost',
  port: 3501,
  path: '/api/news',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
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
    console.log('Response completed');
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.log('API returned an error:', parsed.error);
        if (parsed.details) {
          console.log('Error details:', parsed.details);
        }
      } else if (parsed.news && Array.isArray(parsed.news)) {
        console.log(`Successfully retrieved ${parsed.news.length} news articles`);
        if (parsed.news.length > 0) {
          console.log('First news article:', JSON.stringify(parsed.news[0], null, 2));
        }
        console.log('Pagination info:', parsed.pagination);
      } else {
        console.log('Unexpected response format:', parsed);
      }
    } catch (e) {
      console.log('Failed to parse response as JSON');
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Connection test failed: ${e.message}`);
});

req.end(); 