#!/bin/bash

# Navigate to the application directory
cd "$(dirname "$0")"

echo "==== Starting API Deployment ===="

# Kill any existing PM2 processes for this app
echo "Stopping any existing FUR-API processes..."
pm2 stop FUR-API 2>/dev/null || true
pm2 delete FUR-API 2>/dev/null || true

# Free up ports that might be in use
echo "Checking for processes using port 3500..."
PORT=3500
PORT_CHECK=$(lsof -i:$PORT -t 2>/dev/null)
if [ ! -z "$PORT_CHECK" ]; then
  echo "Port $PORT is in use. Killing process $PORT_CHECK..."
  kill -9 $PORT_CHECK 2>/dev/null || true
  sleep 1
fi

# Update PM2 if needed
echo "Updating PM2..."
pm2 update

# Create/update .env file with correct credentials
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

# Update ecosystem.config.js to match .env
echo "Updating ecosystem.config.js with KNOWN WORKING configuration..."
cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "FUR-API",
    script: "./bin/www",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_restarts: 3,
    restart_delay: 4000,
    env_production: {
      NODE_ENV: "production",
      PORT: 3500,
      DB_HOST: "fur.timefortea.io.vn",
      DB_USER: "thainguyen0802", 
      DB_PASSWORD: "cegatcn!080297",
      DB_NAME: "furnitown",
      DB_PORT: 3306
    }
  }]
}
EOL

# Explicitly set the environment variables
export NODE_ENV=production
export PORT=3500
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
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });
" || {
  echo "Database connection test failed! Please check your credentials."
  exit 1
}

# Start the application with PM2 using the ecosystem config with explicit env flag
echo "Starting application with PM2..."
pm2 start ecosystem.config.js --env production --update-env

# Save the PM2 process list
echo "Saving PM2 process list..."
pm2 save

# Display status
echo "Current PM2 status:"
pm2 status

# Wait a moment for the application to initialize
echo "Waiting for application to initialize..."
sleep 5

# Check if the application is running
if pm2 show FUR-API | grep -q "online"; then
  echo "✅ Application is running successfully!"
  echo "Testing API access..."
  curl -s http://localhost:3500/health | grep -q "status" && echo "API health check successful!" || echo "❌ API health check failed!"
else
  echo "❌ Application failed to start properly."
  echo "Checking logs for errors:"
  pm2 logs FUR-API --lines 20
  exit 1
fi

echo "==== Deployment Complete ===="
echo "API is now running with PM2. Use these commands for management:"
echo "  pm2 status - Check process status"
echo "  pm2 logs FUR-API - View logs"
echo "  pm2 restart FUR-API - Restart the application" 