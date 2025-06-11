const axios = require('axios');

// Base URL for API
const API_URL = 'http://localhost:3501';

// Login credentials - replace with valid credentials
const credentials = {
  email: 'admin@example.com',
  password: 'admin123'
};

async function getToken() {
  try {
    console.log('Attempting to login...');
    const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
    
    if (response.data && response.data.token) {
      console.log('\nLogin successful!');
      console.log('\n-------------------------------------------');
      console.log('JWT Token (copy this for your tests):');
      console.log('-------------------------------------------');
      console.log(response.data.token);
      console.log('-------------------------------------------');
      
      return response.data.token;
    } else {
      console.log('Login successful but no token received');
      console.log('Response:', response.data);
    }
  } catch (error) {
    console.error('Error logging in:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
    } else {
      console.error('Error setting up request:', error.message);
    }
  }
}

// Execute login
getToken(); 