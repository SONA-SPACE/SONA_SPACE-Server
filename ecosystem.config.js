module.exports = {
  apps: [{
    name: "FUR-API",
    script: "./bin/www",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_restarts: 3,
    restart_delay: 4000,
    env: {
      NODE_ENV: "development",
      PORT: 3500,
      DB_HOST: "localhost",
      DB_USER: "root",
      DB_PASSWORD: "",
      DB_NAME: "furnitown",
      DB_PORT: 3306
    },
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