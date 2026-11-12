// ecosystem.config.js — PM2 para producción
// Uso: pm2 start ecosystem.config.js
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: 'crm-mayra-backend',
      script: './backend/dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      log_file: './logs/backend.log',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-err.log',
      time: true,
    },
    {
      name: 'crm-mayra-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_file: '../logs/frontend.log',
      out_file: '../logs/frontend-out.log',
      error_file: '../logs/frontend-err.log',
      time: true,
    },
  ],
};

