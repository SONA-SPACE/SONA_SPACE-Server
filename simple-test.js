const fetch = require('node-fetch');

async function simpleTest() {
    console.log('Testing server at http://localhost:3501');
    
    try {
        const response = await fetch('http://localhost:3501/', {
            timeout: 5000
        });
        console.log('Server is responding:', response.status);
    } catch (error) {
        console.log('Server not responding:', error.message);
    }
}

simpleTest();
