import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let PORT = 3000;
let HOST = '0.0.0.0';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10) || PORT;
    i++;
  } else if (args[i] === '--host' && args[i + 1]) {
    HOST = args[i + 1];
    i++;
  }
}

if (process.env.PORT) {
  PORT = parseInt(process.env.PORT, 10) || PORT;
}


app.get('/api/config.js', (req, res) => {
  res.type('application/javascript');
  const config = {
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
  res.send(`window.APP_CONFIG = Object.freeze(${JSON.stringify(config)});`);
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

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
