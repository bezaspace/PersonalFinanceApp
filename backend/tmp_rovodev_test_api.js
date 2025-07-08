const axios = require('axios');

async function testAPI() {
    console.log('Testing API endpoints...');
    
    const endpoints = [
        'http://192.168.1.36:3000/transactions',
        'http://localhost:3000/transactions',
        'http://127.0.0.1:3000/transactions'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Testing: ${endpoint}`);
            const response = await axios.get(endpoint, { timeout: 5000 });
            console.log(`✅ Success: ${endpoint}`);
            console.log(`Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
            break;
        } catch (error) {
            console.log(`❌ Failed: ${endpoint} - ${error.message}`);
        }
    }
}

testAPI();