#!/bin/bash

# Navigate to the application directory
cd "$(dirname "$0")"

echo "==== Clearing PM2 Logs and Restarting ===="

# Stop the PM2 application
echo "Stopping FUR-API..."
pm2 stop FUR-API

# Clear PM2 logs
echo "Clearing PM2 logs..."
pm2 flush

# Remove all PM2 log files
echo "Removing PM2 log files..."
rm -f ~/.pm2/logs/FUR-API-*.log 2>/dev/null

# Restart the application
echo "Restarting application with clean logs..."
pm2 start ecosystem.config.js --env production --update-env

# Save the PM2 process list
echo "Saving PM2 process list..."
pm2 save

# Display status
echo "Current PM2 status:"
pm2 status

echo "==== Log Cleanup Complete ===="
echo "Your application is now running with fresh logs."
echo "Check the new logs with: pm2 logs FUR-API" 