import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.get('/api/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
    window.APP_CONFIG = {
      FIREBASE_API_KEY: "${process.env.FIREBASE_API_KEY || ''}",
      FIREBASE_APP_ID: "${process.env.FIREBASE_APP_ID || ''}",
      FIREBASE_AUTH_DOMAIN: "${process.env.FIREBASE_AUTH_DOMAIN || ''}",
      FIREBASE_MESSAGING_SENDER_ID: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}",
      FIREBASE_PROJECT_ID: "${process.env.FIREBASE_PROJECT_ID || ''}",
      FIREBASE_STORAGE_BUCKET: "${process.env.FIREBASE_STORAGE_BUCKET || ''}",
      FIREBASE_FUNCTIONS_REGION: "${process.env.FIREBASE_FUNCTIONS_REGION || ''}",
      IMGBB_API_KEY: "${process.env.IMGBB_API_KEY || ''}"
    };
  `);
});

// Serve static assets from root directory
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.includes('/js/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Fallback for single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
