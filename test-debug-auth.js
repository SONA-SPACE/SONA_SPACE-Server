const axios = require('axios');

const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczODAzMDMzNCwiZXhwIjoxNzM4MDMzOTM0fQ.qg8S2p9yagdoOwX-UYAhJWKkpDkZODjw2dafFQNj4HY';

async function testAuth() {
  console.log('🔍 Test 1: /api/orders/count - endpoint hoạt động');
  try {
    const response1 = await axios.get('http://localhost:3501/api/orders/count', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log('✅ Success:', response1.status);
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data);
  }

  console.log('\n🔍 Test 2: /api/orders/1/send-apology-email - endpoint bị lỗi');
  try {
    const response2 = await axios.post('http://localhost:3501/api/orders/1/send-apology-email', {}, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Success:', response2.status, response2.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data);
  }

  console.log('\n🔍 Test 3: /api/orders (GET) - endpoint khác');
  try {
    const response3 = await axios.get('http://localhost:3501/api/orders', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log('✅ Success:', response3.status);
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data);
  }
}

testAuth();
