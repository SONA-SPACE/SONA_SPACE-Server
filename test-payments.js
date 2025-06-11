const axios = require('axios');
const jwt = require('jsonwebtoken');

// Base URL for API
const API_URL = 'http://localhost:3501';

// Use the admin token from test-order-status.js
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ4MDkzNDIzLCJleHAiOjE3NTA2ODU0MjN9.DtGHeWfN4HjIrj5GnEn2NqqubArN4cq-bMO3sqNy5yg';

console.log('Using token from test-order-status.js');

// Function to test GET /api/payments endpoint
async function testGetPayments() {
  console.log('\n-------------------------------------------');
  console.log('Testing GET /api/payments endpoint');
  console.log('-------------------------------------------');
  
  try {
    const response = await axios.get(`${API_URL}/api/payments`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`
      }
    });
    
    console.log(`Status code: ${response.status}`);
    console.log('Headers:', response.headers);
    console.log('Response data (first 2 items):');
    
    if (response.data && Array.isArray(response.data.payments)) {
      console.log(`Total payments: ${response.data.payments.length}`);
      const limitedData = response.data.payments.slice(0, 2);
      console.log(JSON.stringify(limitedData, null, 2));
    } else {
      console.log('Unexpected response format:', response.data);
    }
  } catch (error) {
    console.error('Error fetching payments:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
  }
}

// Function to test GET /api/payments/:id endpoint with a specific payment ID
async function testGetPaymentById(paymentId = 1) {
  console.log('\n-------------------------------------------');
  console.log(`Testing GET /api/payments/${paymentId} endpoint`);
  console.log('-------------------------------------------');
  
  try {
    const response = await axios.get(`${API_URL}/api/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`
      }
    });
    
    console.log(`Status code: ${response.status}`);
    console.log('Response data:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`Error fetching payment with ID ${paymentId}:`);
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

// Function to test GET /api/payments/order/:orderId endpoint
async function testGetPaymentsByOrderId(orderId = 1) {
  console.log('\n-------------------------------------------');
  console.log(`Testing GET /api/payments/order/${orderId} endpoint`);
  console.log('-------------------------------------------');
  
  try {
    const response = await axios.get(`${API_URL}/api/payments/order/${orderId}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`
      }
    });
    
    console.log(`Status code: ${response.status}`);
    console.log('Response data:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`Error fetching payments for order ID ${orderId}:`);
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

// Run all tests
async function runTests() {
  console.log('Starting tests for payments endpoints...');
  
  // Test GET /api/payments endpoint
  await testGetPayments();
  
  // Test GET /api/payments/:id endpoint
  await testGetPaymentById(1);
  
  // Test GET /api/payments/order/:orderId endpoint
  await testGetPaymentsByOrderId(1);
  
  console.log('\nTests completed!');
}

// Execute tests
runTests(); 