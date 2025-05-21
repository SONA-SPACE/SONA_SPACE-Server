#!/bin/bash

# Navigate to the application directory
cd "$(dirname "$0")"

echo "==== Starting API Directly (No PM2) ===="

# Free up the port if in use
PORT=3500
PORT_CHECK=$(lsof -i:$PORT -t 2>/dev/null)
if [ ! -z "$PORT_CHECK" ]; then
  echo "Port $PORT is in use. Killing process $PORT_CHECK..."
  kill -9 $PORT_CHECK 2>/dev/null || true
  sleep 1
fi

# Create or update .env file with correct credentials
echo "Creating/updating .env file with KNOWN WORKING configuration..."
cat > .env << EOL
PORT=3500
NODE_ENV=production
DB_HOST=fur.timefortea.io.vn
DB_USER=thainguyen0802
DB_PASSWORD=cegatcn!080297
DB_NAME=furnitown
DB_PORT=3306
API_URL=https://fur.timefortea.io.vn
API_KEY=1b08ba44df738646b6bc88337f73e5d4ebd7e2b68c6f559a6604c86bed4ee485
JWT_SECRET=troi_oi
JWT_EXPIRES_IN=1h
EOL

# Explicitly set environment variables
export PORT=3500
export NODE_ENV=production
export DB_HOST=fur.timefortea.io.vn
export DB_USER=thainguyen0802
export DB_PASSWORD=cegatcn!080297
export DB_NAME=furnitown
export DB_PORT=3306

# Test database connection directly
echo "Testing database connection..."
node -e "
const mysql = require('mysql2/promise');
const config = {
  host: 'fur.timefortea.io.vn',
  user: 'thainguyen0802',
  password: 'cegatcn!080297',
  database: 'furnitown'
};
console.log('Connecting to database with:', {host: config.host, user: config.user, database: config.database});
mysql.createConnection(config)
  .then(conn => {
    console.log('✅ Database connection successful!');
    conn.end();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });
"

# Start the application directly with Node.js
echo "Starting the application directly with Node.js..."
echo "The server will be available at http://localhost:$PORT"
echo "Press Ctrl+C to stop the server"
echo "-------------------------------------------"

# Run the application in the foreground
node ./bin/www 