// This script checks how dotenv is loading environment variables
console.log('===== Environment Variable Debug Script =====');

// First, log the raw environment before loading .env
console.log('Raw environment variables before loading .env:');
console.log('DB_HOST:', process.env.DB_HOST || 'not set');
console.log('DB_USER:', process.env.DB_USER || 'not set');

// Now load .env
console.log('\nLoading .env file...');
require('dotenv').config();

// Log environment after loading .env
console.log('\nEnvironment variables after loading .env:');
console.log('DB_HOST:', process.env.DB_HOST || 'not set');
console.log('DB_USER:', process.env.DB_USER || 'not set');

// Check all loaded modules for multiple dotenv instances
console.log('\nChecking for multiple dotenv instances:');
const modules = Object.keys(require.cache)
  .filter(modulePath => modulePath.includes('dotenv'));

console.log('Found dotenv modules:', modules.length);
modules.forEach(modulePath => console.log(' -', modulePath));

// Also check for any module that might be setting DB_HOST
console.log('\nModules loaded before this script:');
Object.keys(require.cache)
  .slice(0, 20) // Just show the first 20 to avoid overwhelming output
  .forEach(modulePath => console.log(' -', modulePath));

console.log('\n===== End of Debug Script ====='); 