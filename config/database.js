// Load environment variables but use fixed configuration regardless
require("dotenv").config();

console.log("NODE_ENV:", process.env.NODE_ENV || 'not set');

// FIXED CONFIGURATION - Known to work from logs
// This takes precedence over any environment variables
const WORKING_CONFIG = {
  host: 'fur.timefortea.io.vn',
  user: 'thainguyen0802',
  password: 'Cegatcn!080297',
  database: 'furnitown',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Log the configuration we're using
console.log("Using fixed database config with host:", WORKING_CONFIG.host);

const mysql = require("mysql2/promise");

// Create a connection pool with the working configuration
const pool = mysql.createPool(WORKING_CONFIG);

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to the database:', err);
    console.error('Connection details (without password):', { 
      host: WORKING_CONFIG.host, 
      user: WORKING_CONFIG.user, 
      database: WORKING_CONFIG.database, 
      port: WORKING_CONFIG.port 
    });
    // Don't exit to allow server to continue
  });

module.exports = pool;
