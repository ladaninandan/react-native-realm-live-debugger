const http = require('http');

console.log('🧪 Starting Realm Live Debugger Smoke Test...');

// Set a custom port to prevent conflicting with active development servers
process.env.PORT = '3005';

// Load the server script (starts listening automatically)
require('../server.js');

setTimeout(() => {
  // Query the server
  http.get('http://localhost:3005/', (res) => {
    console.log(`📡 Server response status code: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      console.log('✅ Smoke test passed! Server successfully booted and responded.');
      process.exit(0); // Exit success
    } else {
      console.error(`❌ Smoke test failed: Expected status code 200, got ${res.statusCode}`);
      process.exit(1);
    }
  }).on('error', (err) => {
    console.error('❌ Smoke test failed: Server connection failed:', err.message);
    process.exit(1);
  });
}, 2000);
