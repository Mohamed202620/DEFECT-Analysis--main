import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-config-middleware',
      configureServer(server) {
        server.middlewares.use('/api/config.js', (req, res) => {
          res.setHeader('Content-Type', 'application/javascript');
          const config = {
            FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || 'AIzaSyBocUzghhDY2eY9Dg8B-UwlV-ye844_DtA',
            FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '1:1065779979535:web:6d53e69c4cfde57b414a7a',
            FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || 'maintenance-defect-system.firebaseapp.com',
            FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '1065779979535',
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'maintenance-defect-system',
            FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || 'maintenance-defect-system.firebasestorage.app',
            FIREBASE_FUNCTIONS_REGION: process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1',
            BACKEND_WORKER_URL: process.env.BACKEND_WORKER_URL || 'https://odd-sun-fab8.mom379339.workers.dev',
            IMGBB_API_KEY: process.env.IMGBB_API_KEY || ''
          };
          res.end(`window.APP_CONFIG = Object.freeze(${JSON.stringify(config)});`);
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  }
});
