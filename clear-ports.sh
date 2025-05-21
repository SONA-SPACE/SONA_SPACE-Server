#!/bin/bash

# This script checks for and clears specific ports that might be in use

echo "Checking for processes using important ports..."

for PORT in 3500 3000 8081 8080; do
  echo "Checking port $PORT..."
  
  # Check if port is in use
  PORT_PROCESSES=$(lsof -i:$PORT -t 2>/dev/null)
  
  if [ ! -z "$PORT_PROCESSES" ]; then
    echo "Port $PORT is in use by process(es): $PORT_PROCESSES"
    
    # Get process details
    for PID in $PORT_PROCESSES; do
      echo "Process $PID details:"
      ps -f -p $PID
      
      # Ask for confirmation before killing
      read -p "Kill this process? (y/n): " CONFIRM
      if [ "$CONFIRM" = "y" ]; then
        echo "Killing process $PID..."
        kill -9 $PID 2>/dev/null
        echo "Process $PID killed."
      else
        echo "Process $PID not killed."
      fi
    done
  else
    echo "Port $PORT is not in use."
  fi
done

echo "Port check completed." 