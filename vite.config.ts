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
          // لا توجد قيم افتراضية للإنتاج هنا: الخادم المحلي يعمل كـ dev (APP_ENV الافتراضي dev) ويفشل بدل الاتصال
          // بالإنتاج إذا نقصت المتغيرات (راجع js/firebaseEnv.js). للإنتاج المحلي: APP_ENV=production.
          const config = {
            APP_ENV: process.env.APP_ENV || 'dev',
            FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
            FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '',
            FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || '',
            FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
            FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
            FIREBASE_FUNCTIONS_REGION: process.env.FIREBASE_FUNCTIONS_REGION || '',
            BACKEND_WORKER_URL: process.env.BACKEND_WORKER_URL || '',
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
